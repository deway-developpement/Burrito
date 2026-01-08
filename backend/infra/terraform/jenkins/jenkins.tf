resource "jenkins_credential_secret_text" "kubeconfig" {
  name        = "kubeconfig-burrito"
  description = "Kubeconfig for Burrito cluster"
  secret      = file(pathexpand(var.kubeconfig_path))
}

resource "jenkins_job" "burrito_backend" {
  name = "burrito-backend"

  // Jenkinsfile-from-SCM job definition
  template = templatefile("${path.module}/jenkins-pipeline.xml", {
    repo_url         = var.burrito_repo_url
    branch           = var.burrito_repo_branch
    jenkinsfile_path = "Jenkinsfile"
    k8s_namespace    = var.k8s_namespace
  })

  depends_on = [jenkins_credential_secret_text.kubeconfig]
}

resource "jenkins_job" "burrito_seed_analytics" {
  name = "burrito-seed-analytics"

  template = templatefile("${path.module}/jenkins-pipeline.xml", {
    repo_url         = var.burrito_repo_url
    branch           = var.burrito_repo_branch
    jenkinsfile_path = "backend/Jenkinsfile.seed-analytics"
    k8s_namespace    = var.k8s_namespace
  })

  depends_on = [jenkins_credential_secret_text.kubeconfig]
}
