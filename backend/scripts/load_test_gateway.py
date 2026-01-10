#!/usr/bin/env python3
import argparse
import concurrent.futures
import json
import subprocess
import time
import urllib.error
import urllib.request


def send_request(url: str, host_header: str | None) -> tuple[int, float]:
    headers = {}
    if host_header:
        headers["Host"] = host_header
    req = urllib.request.Request(url, headers=headers)
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            resp.read(128)  # small read to confirm response body is available
            status = resp.status
    except urllib.error.HTTPError as exc:
        status = exc.code
    except Exception:
        status = 0
    latency = (time.time() - start) * 1000
    return status, latency


def watch_scaling(namespace: str, label: str, interval: float = 5.0):
    while True:
        try:
            pods = subprocess.check_output(
                [
                    "kubectl",
                    "get",
                    "pods",
                    "-n",
                    namespace,
                    "-l",
                    label,
                    "-o",
                    "json",
                ],
                text=True,
            )
            data = json.loads(pods)
            pod_names = [item["metadata"]["name"]
                         for item in data.get("items", [])]
            ready_counts = []
            for item in data.get("items", []):
                statuses = item.get("status", {}).get("containerStatuses", [])
                ready = all(cs.get("ready")
                            for cs in statuses) if statuses else False
                ready_counts.append("R" if ready else "NR")
            print(
                f"[scale] pods: {len(pod_names)} -> {list(zip(pod_names, ready_counts))}")
        except Exception as exc:
            print(f"[scale] failed to query pods: {exc}")
            time.sleep(interval * 2)
            continue
        time.sleep(interval)


def main():
    parser = argparse.ArgumentParser(
        description="Fire requests at the API gateway to observe load balancing and HPA scaling.",
    )
    parser.add_argument(
        "--url",
        default="http://127.0.0.1/status",
        help="Gateway URL to hit (default: http://127.0.0.1/status)",
    )
    parser.add_argument(
        "--host-header",
        default="burrito.local",
        help="Host header for ingress (default: burrito.local)",
    )
    parser.add_argument(
        "--requests",
        type=int,
        default=200,
        help="Total number of requests to send.",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=20,
        help="Number of concurrent workers.",
    )
    parser.add_argument(
        "--watch-scaling",
        action="store_true",
        help="Continuously print current gateway pods (uses kubectl).",
    )
    parser.add_argument(
        "--watch-interval",
        type=float,
        default=5.0,
        help="Seconds between kubectl polling when watch-scaling is on (default 5s).",
    )
    args = parser.parse_args()

    if args.watch_scaling:
        import threading

        thread = threading.Thread(
            target=watch_scaling,
            kwargs={
                "namespace": "evaluation-system",
                "label": "app=api-gateway",
                "interval": args.watch_interval,
            },
            daemon=True,
        )
        thread.start()

    statuses: dict[int, int] = {}
    latencies: list[float] = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futures = [
            pool.submit(send_request, args.url, args.host_header)
            for _ in range(args.requests)
        ]
        for fut in concurrent.futures.as_completed(futures):
            try:
                status, latency = fut.result()
            except Exception as exc:
                print(f"[warn] request failed: {exc}")
                status, latency = 0, 0
            statuses[status] = statuses.get(status, 0) + 1
            if latency:
                latencies.append(latency)

    if latencies:
        avg = sum(latencies) / len(latencies)
        p95 = sorted(latencies)[int(0.95 * len(latencies)) - 1]
    else:
        avg = 0
        p95 = 0

    print("\nResults:")
    print(f"  Total: {len(latencies)}")
    print(f"  Status counts: {statuses}")
    print(f"  Avg latency: {avg:.1f} ms")
    print(f"  P95 latency: {p95:.1f} ms")


if __name__ == "__main__":
    main()
