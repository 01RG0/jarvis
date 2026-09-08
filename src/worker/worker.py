"""PC worker agent.

Runs on the home PC. Sends periodic heartbeats to the Jarvis gateway,
reports system issues, and can receive tasks routed from the brain.
"""
import json
import logging
import os
import platform
import socket
import time
import urllib.request
from dataclasses import asdict, dataclass

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GATEWAY_URL = os.environ.get('WORKER_AZURE_ENDPOINT', 'http://localhost:8080/workers/register')
HEARTBEAT_INTERVAL = int(os.environ.get('WORKER_HEARTBEAT_INTERVAL_SECONDS', '30'))
WORKER_ID = os.environ.get('WORKER_ID', socket.gethostname())


@dataclass
class HeartbeatPayload:
    worker_id: str
    hostname: str
    platform: str
    ts: float
    status: str = 'alive'


def _post_json(url: str, payload: dict, timeout: int = 10) -> bool:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            resp.read()
            return True
    except Exception as exc:
        logger.warning('Heartbeat POST failed: %s', exc)
        return False


def _build_heartbeat() -> HeartbeatPayload:
    return HeartbeatPayload(
        worker_id=WORKER_ID,
        hostname=socket.gethostname(),
        platform=platform.system(),
        ts=time.time(),
    )


def run_worker() -> None:
    logger.info('PC worker starting (id=%s, interval=%ss)', WORKER_ID, HEARTBEAT_INTERVAL)
    consecutive_failures = 0
    while True:
        hb = _build_heartbeat()
        ok = _post_json(GATEWAY_URL, asdict(hb))
        if ok:
            consecutive_failures = 0
            logger.debug('Heartbeat sent')
        else:
            consecutive_failures += 1
            if consecutive_failures >= 5:
                logger.error('Gateway unreachable for %d consecutive heartbeats', consecutive_failures)
        time.sleep(HEARTBEAT_INTERVAL)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s %(message)s')
    run_worker()
