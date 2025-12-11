import subprocess
import sys
import time
import os
import signal

PY = sys.executable
ROOT = os.path.dirname(os.path.abspath(__file__))
MAIN = os.path.join(ROOT, 'main.py')
CLIENT = os.path.join(ROOT, 'test_client.py')

env = os.environ.copy()
env['TEST_KEEP_ALIVE'] = '1'

print('Starting intelligence server...')
proc = subprocess.Popen([PY, MAIN], env=env)

try:
    # wait a bit for server to start
    time.sleep(3)

    print('Running test client...')
    client_proc = subprocess.run([PY, CLIENT], env=env, capture_output=False)

    print('Client finished with returncode', client_proc.returncode)

finally:
    print('Stopping server...')
    try:
        proc.terminate()
        proc.wait(timeout=5)
    except Exception:
        proc.kill()
    print('Server stopped')
