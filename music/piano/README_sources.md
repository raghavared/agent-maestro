# Piano Notes Source & Processing

Date: 2026-02-14
Task: task_1771071424522_k5vc9xfze

## Source
Free piano note samples were downloaded from GitHub:
- Repository: https://github.com/gleitz/midi-js-soundfonts
- Path used: MusyngKite/acoustic_grand_piano-mp3/
- Files used: C4.mp3, D4.mp3, E4.mp3, F4.mp3, G4.mp3, A4.mp3, B4.mp3

Raw file URL pattern:
https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/master/MusyngKite/acoustic_grand_piano-mp3/<NOTE>.mp3

## Processing
Each source note was converted to WAV and trimmed to 3 seconds:

ffmpeg -i piano_<NOTE>.mp3 -t 3 -ac 1 piano_<LETTER>.wav

## Output Files
- piano_C.wav
- piano_D.wav
- piano_E.wav
- piano_F.wav
- piano_G.wav
- piano_A.wav
- piano_B.wav

All outputs were validated at 3.000 seconds.
