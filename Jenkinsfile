pipeline {
  agent {
    kubernetes {
      // We define 2 containers: one for the client (nerdctl), one for the daemon (buildkitd)
      yaml """
        apiVersion: v1
        kind: Pod
        spec:
          containers:
          - name: builder
            # An image that already has nerdctl installed
            image: cyphernode/nerdctl:latest
            command: ["cat"]
            tty: true
            env:
              - name: BUILDKIT_HOST
                value: "tcp://localhost:1234" # Connect to the sidecar
          
          - name: buildkitd
            # Official BuildKit image
            image: moby/buildkit:latest
            args: 
              - --addr 
              - tcp://0.0.0.0:1234
            securityContext:
              privileged: true # BuildKit still needs this to create nested containers (overlayfs)
            ports:
              - containerPort: 1234
        """
    }
  }

  parameters {
    string(name: 'K8S_NAMESPACE', defaultValue: 'evaluation-system', description: 'Target Kubernetes namespace')
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Build Images') {
      steps {
        container('builder') {
          script {
            // No need to install nerdctl or buildkitd manually!
            
            // 1. Wait for buildkitd sidecar to be ready
            sh 'while ! nerdctl info > /dev/null 2>&1; do sleep 1; echo "Waiting for buildkitd..."; done'

            dir('backend') {
              def services = ['api-gateway', 'users-ms', 'forms-ms', 'evaluations-ms']
              
              services.each { svc ->
                echo "Building ${svc}..."
                
                // Using BuildKit cache imports/exports for maximum efficiency
                sh """
                  nerdctl build \\
                    --namespace k8s.io \\
                    --build-arg SERVICE_NAME=${svc} \\
                    --output type=image,name=burrito-${svc}:${env.BUILD_NUMBER},push=false \\
                    --export-cache type=inline \\
                    .
                """
                // Note: If you have a registry, add --push=true and change the name to registry/image
              }
            }
          }
        }
      }
    }
    
    stage('Deploy to Kubernetes') {
      steps {
        container('builder') {
          withCredentials([string(credentialsId: env.KUBECONFIG_CRED, variable: 'KUBECONFIG_CONTENT')]) {
            sh '''
              set -e
              export KUBECONFIG=/tmp/kubeconfig
              printf "%s" "$KUBECONFIG_CONTENT" > "$KUBECONFIG"
              chmod 600 "$KUBECONFIG"

              if [ -n "$KUBE_CONTEXT" ]; then
                kubectl config use-context "$KUBE_CONTEXT"
              fi

              # Ensure base manifests are present
              kubectl apply -f backend/k8s/evaluation-system.yaml

              # Update deployments with freshly built images
              kubectl set image deployment/api-gateway api-gateway=burrito-api-gateway:${BUILD_NUMBER} -n "$K8S_NAMESPACE"
              kubectl set image deployment/users-ms users-ms=burrito-users-ms:${BUILD_NUMBER} -n "$K8S_NAMESPACE"
              kubectl set image deployment/forms-ms forms-ms=burrito-forms-ms:${BUILD_NUMBER} -n "$K8S_NAMESPACE"
              kubectl set image deployment/evaluations-ms evaluations-ms=burrito-evaluations-ms:${BUILD_NUMBER} -n "$K8S_NAMESPACE"

              kubectl rollout status deployment/api-gateway -n "$K8S_NAMESPACE"
              kubectl rollout status deployment/users-ms -n "$K8S_NAMESPACE"
              kubectl rollout status deployment/forms-ms -n "$K8S_NAMESPACE"
              kubectl rollout status deployment/evaluations-ms -n "$K8S_NAMESPACE"
            '''
          }
        }
      }
    }
  }
}