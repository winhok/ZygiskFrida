# xDL upstream

The sources in this directory are vendored from
[hexhacking/xDL](https://github.com/hexhacking/xDL).

- Upstream version: `2.4.0` plus the post-release fix below
- Upstream commit: `1e0b6254165a2ddcbd32f77a371700c69155acf8`
- Synced: 2026-07-16

The post-release commit optimizes LZMA decompression and eliminates potential
double-free issues. `CMakeLists.txt` is intentionally not vendored because this
project compiles the C sources directly through its existing `Android.mk`.
