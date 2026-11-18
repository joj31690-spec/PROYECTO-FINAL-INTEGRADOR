import json
from pathlib import Path

root = Path('/reports')
expected = json.loads(Path('/opt/cultura/data/demo-expected.json').read_text())
for name in ('sequential', 'openmp-1', 'openmp-2', 'mpi-1', 'mpi-3'):
    actual = json.loads((root / f'{name}.json').read_text())
    if actual != expected:
        raise SystemExit(f'FAIL {name}: result differs from the JS oracle')
    print(f'PASS {name}: every evaluation, answer detail and aggregate matches JS')
assert expected['aggregate'] == {'evaluations': 8, 'passed': 5, 'correct': 23, 'questions': 40, 'totalScore': 460}
print('CORRECTNESS PASS: 8 evaluations; 23/40 correct; 5 passed; total score 460.')
