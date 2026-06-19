# Core Runtime Systems Benchmark

Generated: 2026-06-18

Command:

```bash
node scripts/benchmark-core-systems.js
```

Scenario:

- 1000 static entities.
- Grid size: 32x32.
- Query: center `(16, 16)`, radius `15`.
- Iterations: 20000.

Result:

| Metric | Full Scan | Spatial Index |
| --- | ---: | ---: |
| Time | 2245.957 ms | 10.81 ms |
| Entities or candidates visited per query | 1000 | 1 |
| Filter calls per query | 1000 | 1 |
| Hits per query | 1 | 1 |

Speedup:

- Candidate reduction: 1000x.
- Wall-clock speedup: 207.76x.
- Pass condition: candidate reduction >= 50x and wall-clock speedup >= 50x.
