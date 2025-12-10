resource "jenkins_credential_secret_text" "kubeconfig" {
  name        = "kubeconfig-burrito"
  description = "Kubeconfig for Burrito cluster"
  secret      = file(pathexpand(var.kubeconfig_path))

  depends_on = [helm_release.jenkins]
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

  depends_on = [
    helm_release.jenkins,
    jenkins_credential_secret_text.kubeconfig
  ]
}
