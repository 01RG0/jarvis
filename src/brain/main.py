import sys
import json
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from llm_router import call_llm
from db import log_call, init_db

parser = argparse.ArgumentParser(description='Jarvis Brain')
parser.add_argument('prompt', nargs='?', default='hello', help='Prompt to send')
parser.add_argument('--model', default='balanced', choices=['fast', 'balanced', 'smart'])
parser.add_argument('--json', action='store_true', dest='as_json')


def main():
    args = parser.parse_args()
    init_db()
    try:
        result = call_llm(args.model, args.prompt)
        log_call(args.prompt, result['content'], result['model_used'], result['cost_usd'], result['duration_ms'])
        if args.as_json:
            print(json.dumps(result, indent=2))
        else:
            print(result['content'])
    except Exception as e:
        print(f'Error: {e}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
