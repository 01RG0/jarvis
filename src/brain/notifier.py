import logging
import os
import threading
import urllib.parse
import urllib.request

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

PUSH_PROVIDER = os.environ.get('PUSH_PROVIDER', 'telegram')
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_CHAT_ID = os.environ.get('TELEGRAM_CHAT_ID', '')


def _send_telegram(text: str) -> None:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.warning('Telegram not configured — set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID')
        return
    url = f'https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage'
    payload = urllib.parse.urlencode({'chat_id': TELEGRAM_CHAT_ID, 'text': text, 'parse_mode': 'HTML'}).encode()
    req = urllib.request.Request(url, data=payload, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp.read()
    except Exception as exc:
        logger.error('Telegram send failed: %s', exc)


def notify(text: str) -> None:
    if PUSH_PROVIDER == 'telegram':
        threading.Thread(target=_send_telegram, args=(text,), daemon=True).start()
    else:
        logger.info('[notify/%s] %s', PUSH_PROVIDER, text)


def notify_task_complete(task_id: str, result: str, cost_usd: float) -> None:
    snippet = result[:300] + '…' if len(result) > 300 else result
    notify(f'<b>Jarvis ✓</b>\n<code>{task_id}</code>\n{snippet}\n<i>${cost_usd:.4f}</i>')


def notify_error(context: str, error: str) -> None:
    notify(f'<b>Jarvis ✗</b> {context}\n<code>{error[:500]}</code>')
