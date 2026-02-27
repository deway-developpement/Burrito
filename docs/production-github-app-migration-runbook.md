# Production Branch Security Migration Runbook

This runbook migrates `production` push auth from PAT to GitHub App for Jenkins.

## 1) Baseline capture (before cutover)

```bash
OWNER="deway-developpement"
REPO="Burrito"
RULESET_ID="13297101"

mkdir -p .tmp
gh api "/repos/${OWNER}/${REPO}/rulesets/${RULESET_ID}" > ".tmp/ruleset-${RULESET_ID}-before.json"
git show <baseline-ref>:Jenkinsfile | rg -n "burrito-git-push-token|GIT_PUSH_TOKEN"
```

## 2) GitHub App prerequisites

Create GitHub App `jenkins-gitops` and install it on `deway-developpement/Burrito`.

Required repository permissions:
- `Contents: Read and write`
- `Metadata: Read`

Collect:
- `APP_ID`
- `APP_SLUG` (for auditing/UI checks)
- `INSTALLATION_ID`
- App private key PEM

## 3) Terraform variables for Jenkins credentials

Set the new variables in Terraform input (`*.tfvars` or environment):

- `burrito_github_app_id`
- `burrito_github_app_installation_id`
- `burrito_github_app_private_key_pem`

Then apply:

```bash
cd backend/infra/terraform/jenkins
terraform init
terraform plan
terraform apply
```

## 4) Ruleset update (`production`)

Update ruleset `13297101` to allow direct updates only from the App.

```bash
OWNER="deway-developpement"
REPO="Burrito"
RULESET_ID="13297101"
APP_SLUG="jenkins-gitops"
APP_ID="<numeric-app-id>"

gh api \
  -X PUT \
  "/repos/${OWNER}/${REPO}/rulesets/${RULESET_ID}" \
  -H "Accept: application/vnd.github+json" \
  --input - <<JSON
{
  "name": "Production only from main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/production"],
      "exclude": []
    }
  },
  "bypass_actors": [
    {
      "actor_id": ${APP_ID},
      "actor_type": "Integration",
      "bypass_mode": "always"
    }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "update",
      "parameters": {
        "update_allows_fetch_and_merge": false
      }
    }
  ]
}
JSON
```

Notes:
- The app allowlist is enforced through `bypass_actors` (`Integration`) plus the `update` rule.
- Keep `deletion` and `non_fast_forward` enabled.

## 5) Cutover validation

1. Trigger `main` Jenkins build and verify `Promote GitOps` can push to `production`.
2. Try human push to `production` and verify it fails.
3. Verify Jenkins fails if any file other than `backend/k8s/overlays/prod/kustomization.yaml` is modified in promotion stage.
4. Verify installation token is generated at runtime and not stored.
5. Remove old PAT credential (`burrito-git-push-token`) from Jenkins if still present.

## 6) Rollback

If cutover fails:

1. Restore ruleset from baseline JSON or UI.
2. Restore previous Jenkinsfile on a rollback branch and redeploy job config.
3. Re-enable PAT credential temporarily.
4. Re-run pipeline and confirm promotion recovers.
