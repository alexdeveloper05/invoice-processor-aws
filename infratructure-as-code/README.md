# Infrastructure as Code

Terraform config for the AWS infrastructure of this project, deployed manually from GitHub Actions ([.github/workflows/terraform.yml](../.github/workflows/terraform.yml)).

## One-time setup

### 1. Create the remote state backend

Terraform state is stored in S3 (with versioning + encryption) and locked via DynamoDB, so `apply` from CI is safe even if two runs overlap. This backend can't be managed by the same Terraform state it will host, so create it once, manually, from the [`bootstrap/`](./bootstrap) config:

```bash
cd infratructure-as-code/bootstrap
terraform init
terraform apply \
  -var="state_bucket_name=<globally-unique-bucket-name>" \
  -var="aws_region=<your-region>"
```

Keep the resulting bucket and table names — you'll need them in step 3.

### 2. Create an IAM user for GitHub Actions

Create an IAM user (e.g. `github-actions-terraform`) with an access key, and a policy that allows it to:
- Read/write the state bucket and lock table from step 1.
- Manage whatever AWS services the modules under `infratructure-as-code/` provision (S3, API Gateway, Lambda, DynamoDB, etc.). Scope this down to just those services/resources rather than using `AdministratorAccess`.

### 3. Configure the GitHub repository

Under **Settings > Secrets and variables > Actions**:

**Secrets** (sensitive):
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

**Variables** (non-sensitive):
- `AWS_REGION` — e.g. `us-east-1`
- `TF_STATE_BUCKET` — bucket name from step 1
- `TF_STATE_LOCK_TABLE` — table name from step 1

Optionally, under **Settings > Environments**, create a `production` environment with required reviewers. The workflow already runs `apply`/`destroy` under that environment, so adding reviewers there gates them behind manual approval automatically.

## Running Terraform

Go to **Actions > Terraform > Run workflow** and pick an action:
- `plan` — preview changes.
- `apply` — apply changes to AWS.
- `destroy` — tear down the managed infrastructure.
- `fmt-validate` — check formatting and validate the config.

## Local development

```bash
cd infratructure-as-code
terraform init \
  -backend-config="bucket=<TF_STATE_BUCKET>" \
  -backend-config="key=invoice-processor/terraform.tfstate" \
  -backend-config="region=<AWS_REGION>" \
  -backend-config="dynamodb_table=<TF_STATE_LOCK_TABLE>"
terraform plan -var="aws_region=<AWS_REGION>"
```
