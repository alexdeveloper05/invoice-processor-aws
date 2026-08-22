# Invoice Processor

A small, low-cost web app for keeping track of receipts: upload a photo or PDF of a ticket, and it automatically pulls out the vendor, date, total, tax and what was bought — no manual data entry. Built entirely on serverless AWS, so it costs close to nothing when nobody's using it.

## What it does

- **Upload** a ticket from your computer or, on your phone, straight from the camera.
- **Textract** (AWS's OCR/document-understanding service) reads it and extracts the useful fields, including line items.
- **Tickets** tab shows everything you've uploaded, with filters by date range, status, and vendor.
- **Finances** tab rolls that up into totals, monthly spend, and your top vendors — the kind of thing a small business actually wants to see.

## Architecture

![architecture diagram](/public/diagram.png)

- **Website**: a static Next.js app in [`frontend/`](frontend), served privately through CloudFront (no public S3 access).
- **Auth**: Amazon Cognito. Users sign in with email/password; there's no self-service sign-up yet (see [Creating a user](#creating-a-user) below).
- **API**: an HTTP API Gateway, every route protected by a Cognito JWT check.
- **Upload**: the browser asks the API for a short-lived, single-use presigned S3 URL and uploads the file directly to S3 — the file itself never passes through a Lambda.
- **Processing**: uploading a ticket triggers Textract asynchronously (so multi-page PDFs work too); the result is written to DynamoDB.
- **Infrastructure**: all of the above is Terraform, in [`infratructure-as-code/`](infratructure-as-code), deployed manually from a GitHub Actions workflow — nothing deploys automatically on push.

## Deploying it yourself

This is a from-scratch AWS deployment — there's no shared/hosted instance. You'll need your own AWS account and a fork or copy of this repo.

The full, step-by-step walkthrough (creating the AWS user, the Terraform state backend, wiring up GitHub secrets, running the workflow) lives in **[infratructure-as-code/README.md](infratructure-as-code/README.md)**. In short:

1. Create an AWS IAM user with an access key, and use it once, locally, to bootstrap the Terraform state backend (an S3 bucket + DynamoDB table Terraform uses to keep track of what it's created).
2. Add that access key, plus a few config values, as GitHub Actions secrets/variables.
3. From the **Actions** tab, run the **Terraform** workflow with `apply`. This builds the frontend, creates every piece of AWS infrastructure, and uploads the site — one workflow run, no manual `aws s3 sync` or anything like that.

That workflow can also run `plan` (preview changes) and `destroy` (tear everything down) on demand, and `fmt-validate` as a quick sanity check.

## Creating a user

There's no sign-up page — you create accounts yourself, from AWS CloudShell (a terminal built into the AWS Console, already logged in, nothing to install):

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

Sessions stay signed in for up to 10 days (or until you sign out), refreshing automatically in the background.

## Using it

- **Upload** tab: drag & drop, click to browse, or (on a phone) tap "Take a photo" to use the camera directly.
- **Tickets** tab: everything you've uploaded, newest first, with a "what was bought" breakdown per ticket when Textract found line items. Filter by time period, status, or vendor.
- **Finances** tab: total spend, average ticket, monthly breakdown, and top vendors — same filters apply.

## Local development

```bash
cd frontend
npm install
npm run dev
```