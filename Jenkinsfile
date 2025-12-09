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
            # We use a base image that has standard tools (curl, tar)
            image: node:18-bullseye
            tty: true
            command: ["cat"]
            securityContext:
              privileged: true # REQUIRED to access the host socket
            volumeMounts:
              # Mount the Host's containerd socket so we can write images directly to K8s
              - name: containerd-sock
                mountPath: /run/k3s/containerd/containerd.sock
          volumes:
            - name: containerd-sock
              hostPath:
                path: /run/k3s/containerd/containerd.sock
        """
    }
  }

  options {
    timeout(time: 30, unit: 'MINUTES')
  }

  environment {
    // The path INSIDE the container where we mounted the socket
    HOST_CONTAINERD_SOCK = '/run/k3s/containerd/containerd.sock'
    // Versions to install
    NERDCTL_VERSION = 'latest'
    BUILDKIT_VERSION = 'latest'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install Build Tools') {
      steps {
        container('builder') {
          sh '''
            set -e
            # 1. Install nerdctl (Client)
            if ! command -v nerdctl >/dev/null 2>&1; then
              echo "Installing nerdctl..."
              curl -sL "https://github.com/containerd/nerdctl/releases/download/v${NERDCTL_VERSION}/nerdctl-${NERDCTL_VERSION}-linux-amd64.tar.gz" | tar -xz -C /usr/local/bin nerdctl
            fi

            # 2. Install buildkitd (Builder Daemon)
            if ! command -v buildkitd >/dev/null 2>&1; then
              echo "Installing buildkit..."
              curl -sL "https://github.com/moby/buildkit/releases/download/v${BUILDKIT_VERSION}/buildkit-v${BUILDKIT_VERSION}.linux-amd64.tar.gz" | tar -xz -C /usr/local/bin
            fi
          '''
        }
      }
    }

    stage('Build Local Images') {
      steps {
        container('builder') {
          sh '''
            set -e
            
            # --- START BUILDKIT DAEMON ---
            # We start buildkitd inside the pod, but tell it to use the HOST's containerd as its worker.
            # This is the magic trick that puts images directly into K8s.
            
            mkdir -p /run/buildkit
            rm -f /run/buildkit/buildkitd.sock

            echo "Starting buildkitd connected to host containerd..."
            buildkitd \
              --addr unix:///run/buildkit/buildkitd.sock \
              --containerd-worker=true \
              --containerd-worker-addr "${HOST_CONTAINERD_SOCK}" \
              --oci-worker=false \
              > /tmp/buildkitd.log 2>&1 &
            
            PID=$!
            
            # Wait for it to allow connections
            timeout 30s bash -c 'until buildctl --addr unix:///run/buildkit/buildkitd.sock debug workers >/dev/null 2>&1; do sleep 1; done'
            echo "Buildkit is ready and connected to Host!"

            # --- BUILD LOOP ---
            cd backend
            
            # Define your services list here
            SERVICES="api-gateway users-ms forms-ms evaluations-ms"

            for svc in $SERVICES; do
              echo "-------------------------------------------------"
              echo "Building Service: $svc"
              echo "-------------------------------------------------"
              
              # nerdctl build acts exactly like docker build
              # We point it to our local buildkitd socket
              
              nerdctl \
                --address "${HOST_CONTAINERD_SOCK}" \
                --buildkit-host "unix:///run/buildkit/buildkitd.sock" \
                --namespace k8s.io \
                build \
                --build-arg SERVICE_NAME=${svc} \
                -t burrito-${svc}:${BUILD_NUMBER} \
                -t burrito-${svc}:latest \
                .
            done

            # Verify images are actually in the host runtime
            echo "Verifying images in k8s.io namespace:"
            nerdctl --address "${HOST_CONTAINERD_SOCK}" --namespace k8s.io images | grep burrito

            # Cleanup daemon
            kill $PID
          '''
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