# Argo CD GitOps bootstrap

This folder contains the Argo CD resources for production sync:

- `appproject-burrito.yaml`: scope restriction to `evaluation-system`.
- `application-burrito-prod.yaml`: syncs `backend/k8s/overlays/prod` from branch `production`.

## Cutover checklist

1. Apply Terraform changes to install Argo CD and create these resources.
2. Open the Argo CD UI (`https://argocd.burrito.deway.fr`) and verify `burrito-prod` reaches `Synced` and `Healthy`.
3. Trigger one Jenkins build on `main` and confirm `production` is updated (merge from `main` + overlay image tags).
4. Validate workload rollout from Argo CD history (no direct Jenkins app deploy).
5. Roll back by reverting the promotion commit in Git, then re-sync in Argo CD.
