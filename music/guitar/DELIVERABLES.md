# Guitar Notes Deliverables

Task: `task_1771071425692_la3raufi2`
Session: `sess_1771072861976_k4xn2bvq4`
Date: 2026-02-14

## Output Files
- `guitar_C.wav` (source pitch: C3)
- `guitar_D.wav` (source pitch: D3)
- `guitar_E.wav` (source pitch: E3)
- `guitar_F.wav` (source pitch: F3)
- `guitar_G.wav` (source pitch: G3)
- `guitar_A.wav` (source pitch: A3)
- `guitar_B.wav` (source pitch: B3)

All files are mono PCM WAV at 44.1kHz, 16-bit, trimmed to 3.0s.

## Source
- Philharmonia Orchestra sample library (guitar instrument pack)
- Package used: `Strings.zip`
- Direct URL used: `https://philharmonia-assets.s3-eu-west-1.amazonaws.com/uploads/2020/02/12112005/Strings.zip`

## Processing
1. Extracted required MP3 notes from `Strings.zip`
2. Trimmed each to 3 seconds with `avconvert --duration 3`
3. Converted to WAV using `afconvert`
