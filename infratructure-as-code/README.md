# Infrastructure as Code

This folder holds the Terraform config for this project's AWS infrastructure. It's applied manually, on demand, from a GitHub Actions workflow — not automatically on every push.

Terraform needs a place to keep track of what it has already created (its "state"). We store that state remotely in an S3 bucket, with a DynamoDB table used as a lock so two runs (e.g. two people, or CI + your laptop) can't apply changes at the same time and corrupt it. **This bucket and table are not part of the invoice-processor app** — they only exist so Terraform can keep its own bookkeeping. You only set them up once, and then never touch them again.

## One-time setup

You only do this once, before the very first `terraform apply`.

### 1. Create an AWS user with an access key

1. Open the [AWS Console](https://console.aws.amazon.com) → search for **IAM** → **Users** → **Create user**.
2. Name it `github-actions-terraform`. Leave "Provide user access to the AWS Management Console" unchecked — this user is only used by Terraform/GitHub, not for logging in.
3. Under permissions, choose **Attach policies directly** and attach `AdministratorAccess` for now (fine while the project is small; tighten it later to only the services actually used — S3, DynamoDB, Lambda, API Gateway, etc.).
4. Open the user → **Security credentials** tab → **Create access key** → use case **Command Line Interface (CLI)**.
5. Copy the **Access key ID** and **Secret access key** somewhere safe — the secret is only shown once.

### 2. Create the state bucket + lock table (once, from your machine)

This is the chicken-and-egg part: the bucket that will hold Terraform's state can't be created by that same state, so it lives in its own small config under [`bootstrap/`](./bootstrap) and you run it locally, directly, using the keys from step 1:

```bash
export AWS_ACCESS_KEY_ID="<access key from step 1>"
export AWS_SECRET_ACCESS_KEY="<secret key from step 1>"
export AWS_DEFAULT_REGION="us-east-1"   # or whichever region you want

cd infratructure-as-code/bootstrap
terraform init
terraform apply \
  -var="state_bucket_name=<pick-a-globally-unique-name>" \
  -var="aws_region=us-east-1"
```

`state_bucket_name` must be lowercase and unique across *all* of AWS, not just your account — e.g. `invoice-processor-tfstate-yourname123`.

When it finishes, it prints an `Outputs:` block with the bucket name and the lock table name (`invoice-processor-terraform-locks` by default). Keep both — you need them in step 3.

### 3. Give GitHub the AWS keys and the bucket/table names

In your repo: **Settings → Secrets and variables → Actions**.

**Secrets tab** (sensitive — same keys from step 1):
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

**Variables tab** (not sensitive):
- `AWS_REGION` — e.g. `us-east-1`
- `TF_STATE_BUCKET` — the bucket name from step 2's output
- `TF_STATE_LOCK_TABLE` — the table name from step 2's output

### 4. (Optional) Require approval before apply/destroy

**Settings → Environments → New environment** → name it exactly `production` → add yourself under "Required reviewers" → Save.

The workflow already runs `apply` and `destroy` under an environment called `production`, so once you add reviewers there, those two actions pause and wait for your approval in the Actions tab before touching AWS — `plan` and `fmt-validate` are unaffected and run immediately.

## Running Terraform day-to-day

Repo → **Actions** tab → **Terraform** (left sidebar) → **Run workflow**, then pick:
- `plan` — preview what would change, changes nothing.
- `apply` — actually create/update resources in AWS.
- `destroy` — tear down everything Terraform manages here.
- `fmt-validate` — checks formatting and that the config is syntactically valid.

Start new changes with `plan` (or `fmt-validate`) before ever running `apply`.

## Uploading tickets

The frontend uploads tickets straight to S3 using short-lived presigned URLs, so the file itself never passes through Lambda or API Gateway:

1. The browser calls `POST {api_base_url}tickets/presigned-url` with a Cognito ID token (`Authorization: Bearer ...`).
2. API Gateway validates that token against the Cognito user pool (JWT authorizer) before the request even reaches the Lambda.
3. The `presigned-url` Lambda signs a PUT URL scoped to a single S3 key (under the caller's Cognito `sub`), valid for 5 minutes.
4. The browser PUTs the file directly to that URL.

There's no self-service sign-up screen yet — create test users manually:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <cognito_user_pool_id from `terraform output`> \
  --username someone@example.com \
  --user-attributes Name=email,Value=someone@example.com Name=email_verified,Value=true \
  --message-action SUPPRESS

aws cognito-idp admin-set-user-password \
  --user-pool-id <cognito_user_pool_id> \
  --username someone@example.com \
  --password "<a-strong-password>" \
  --permanent
```

## Processing tickets

Once a file lands in the invoice warehouse bucket, it's picked up automatically — no polling, no manual step. This uses Textract's *asynchronous* API (`StartExpenseAnalysis`/`GetExpenseAnalysis`), which is the only mode that supports multi-page PDFs — the synchronous `AnalyzeExpense` call is limited to a single page, so it wouldn't work for a multi-page invoice. The same async path handles plain single-page images too, so there's just one code path either way:

1. The S3 upload triggers `textract-caller` (S3 event notification), which calls `StartExpenseAnalysis` and returns immediately — it doesn't wait for the result.
2. Textract processes the document in the background (can take anywhere from a few seconds to a couple of minutes depending on page count) and, when done, publishes a notification to an SNS topic.
3. That notification triggers `textract-result-handler`, which fetches the actual result (`GetExpenseAnalysis`, paginated) and pulls out the summary fields (vendor, total, date, tax, etc.) for each expense Textract detected — usually one per page for a multi-page invoice, or one per receipt if a single upload contained several. Textract doesn't tell us which case we're in, so this is stored as a list (`pages`) rather than assumed to be one set of fields.
4. It invokes `data-writer` (Lambda-to-Lambda, async) with either that list or, if the job failed (blurry photo, unsupported content, etc.), an error message. `textract-caller` also invokes `data-writer` directly if *starting* the job itself fails.
5. `data-writer` puts one item per ticket into the `invoice-processor-tickets` DynamoDB table, keyed by `userId` (Cognito `sub`) + `ticketId`, with `status` of `PROCESSED` or `FAILED`.

There's no UI to browse this data yet (that's the still-unbuilt `reader` piece from the diagram) — for now you can check it landed correctly with:

```bash
aws dynamodb scan --table-name invoice-processor-tickets
```

### Frontend runtime config

The deployed site fetches `/config.json` at runtime to learn the Cognito and API Gateway IDs — Terraform generates and uploads it as part of `apply`, so the frontend build itself doesn't need any of these values baked in.

For local development (`npm run dev` inside `frontend/`), create `frontend/public/config.json` yourself (it's gitignored) with the same shape, using values from `terraform output`:

```json
{
  "awsRegion": "us-east-1",
  "cognitoUserPoolId": "...",
  "cognitoClientId": "...",
  "apiBaseUrl": "https://....execute-api.us-east-1.amazonaws.com/"
}
```

## Running it from your own machine (optional)

```bash
cd infratructure-as-code
terraform init \
  -backend-config="bucket=<TF_STATE_BUCKET>" \
  -backend-config="key=invoice-processor/terraform.tfstate" \
  -backend-config="region=<AWS_REGION>" \
  -backend-config="dynamodb_table=<TF_STATE_LOCK_TABLE>"
terraform plan -var="aws_region=<AWS_REGION>"
```
