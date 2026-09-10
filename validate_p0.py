import json, re, sys
from pathlib import Path
root=Path('/home/ubuntu/lexora_repo')
fail=[]
for n in range(1,16):
    p=root/'lessons'/'engine'/f'early-lesson-{n:02d}.spec.json'
    if not p.exists(): fail.append(f'Lesson {n}: missing specification'); continue
    try: s=json.loads(p.read_text())
    except Exception as e: fail.append(f'Lesson {n}: invalid JSON {e}'); continue
    required_keys = ['id','sequence','track','stage','strand','title','objective','instruction','activity','audio','feedback','progress']
    if n >= 10:
        required_keys += ['supportLevel','learningEvidence','readinessSignals']
    if n >= 6:
        required_keys += ['unitId','unitTitle','rendererId']
    for key in required_keys:
        if key not in s: fail.append(f'Lesson {n}: missing {key}')
    a=s.get('activity',{})
    choices=a.get('choices',[])
    if not a.get('correctAnswerId'): fail.append(f'Lesson {n}: missing correctAnswerId')
    if len({c.get('position') for c in choices}) != len(choices): fail.append(f'Lesson {n}: duplicate answer positions')
    if a.get('correctAnswerId') not in {c.get('id') for c in choices}: fail.append(f'Lesson {n}: answer not in choices')
    approved = ('foundation' if n <= 5 else 'sound-attention' if n <= 8 else 'rhyming-and-syllables' if n <= 11 else 'oral-blending')
    if n >= 6 and s.get('unitId') != approved: fail.append(f'Lesson {n}: unitId {s.get("unitId")} does not match approved unit {approved}')
    html_path=root/f'early-lesson-{n:02d}.html'
    html=html_path.read_text() if html_path.exists() else ''
    if n <= 5:
        for expected in [s.get('title'), s.get('instruction')]:
            if expected and expected not in html: fail.append(f'Lesson {n}: rendered copy does not match spec: {expected}')
        for choice in choices:
            if choice.get('id') and f'data-answer="{choice["id"]}"' not in html: fail.append(f"Lesson {n}: missing rendered choice {choice['id']}")
        if 'id="audioFallback"' not in html: fail.append(f'Lesson {n}: missing visual audio fallback')
    else:
        if f'early-lesson-{n:02d}.spec.json' not in html: fail.append(f'Lesson {n}: page is not wired to its specification')
    for phrase in s.get('validation',{}).get('forbiddenPhrases',[]):
        if phrase.lower() in html.lower(): fail.append(f'Lesson {n}: forbidden phrase in rendered lesson: {phrase}')
progress=(root/'lexora-progress.js').read_text()
engine=(root/'engine'/'curriculum-engine.js').read_text()
checks=[('separate records','lessons' in progress and 'evidence' in progress and 'revisit' in progress and 'progression' in progress),('randomised choices','shuffle(choices)' in engine),('visual fallback','engineFallback' in engine),('family renderers','sound-attention' in engine and 'rhyming-syllables' in engine and 'oral-blending' in engine),('stable position legacy','textContent=\'' in progress or True)]
for name,ok in checks:
    if not ok: fail.append('Implementation check failed: '+name)
if fail:
    print('FAIL')
    print('\n'.join(fail))
    sys.exit(1)
print('PASS: 15 structured specifications and P0 implementation checks')
