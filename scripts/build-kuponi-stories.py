"""Assemble 16 generated poses into long alpha animations; no model/API calls.

pip install pillow numpy opencv-python-headless
python scripts/build-kuponi-stories.py
Sources are generated artwork. In-betweens are optical-flow interpolation,
not independently rendered 3D frames. Original sources remain untouched.
"""
from pathlib import Path
import json
import math
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/mascot/stories'
SIZE, CELL, FPS, COLS = 256, 160, 20, 16
STORIES = {'wallet-review': 12, 'merchant-match': 12, 'priority-pick': 10, 'clean-month': 14}
yy, xx = np.mgrid[:SIZE, :SIZE].astype(np.float32)

def rgba(data):
    alpha = data[:, :, 3:4]
    rgb = np.divide(data[:, :, :3], alpha, out=np.zeros_like(data[:, :, :3]), where=alpha > .001)
    return Image.fromarray(np.uint8(np.clip(np.concatenate([rgb, alpha], 2)*255, 0, 255)))

def pixels(im):
    d = np.asarray(im).astype(np.float32)/255
    d[:, :, :3] *= d[:, :, 3:4]
    return d

def gray(d):
    return cv2.cvtColor(np.uint8(np.clip((d[:, :, :3]+(1-d[:, :, 3:4])*.5)*255, 0, 255)), cv2.COLOR_RGB2GRAY)

def warp(data, flow, amount):
    amount = np.float32(amount)
    mx, my = xx.copy(), yy.copy()
    for _ in range(4):
        sampled = cv2.remap(flow, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        mx, my = xx-amount*sampled[:, :, 0], yy-amount*sampled[:, :, 1]
    return cv2.remap(data, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)

def prepare(source):
    sheet = Image.open(source).convert('RGBA')
    assert np.asarray(sheet)[:, :, 3].min() == 0, 'Source must have real alpha'
    keys = []
    for i in range(16):
        x, y = i % 4, i // 4
        im = sheet.crop((round(x*sheet.width/4),round(y*sheet.height/4),round((x+1)*sheet.width/4),round((y+1)*sheet.height/4)))
        d = np.array(im)
        # Drop disconnected generation specks, retain all substantive props.
        count, labels, stats, _ = cv2.connectedComponentsWithStats((d[:,:,3] > 48).astype('uint8'), 8)
        keep = np.zeros(d.shape[:2], 'uint8')
        for k in range(1,count):
            if stats[k,cv2.CC_STAT_AREA] > 180:
                keep[labels == k] = 1
        keep = cv2.dilate(keep, np.ones((3,3),'uint8'))
        d[:,:,3] *= keep
        # Every cell gets the same scale and origin, with a transparent gutter.
        small = Image.fromarray(d).resize((232,232),Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA',(SIZE,SIZE))
        canvas.alpha_composite(small,(12,12))
        keys.append(canvas)
    return keys

all_frames, manifest = {}, {}
for name, seconds in STORIES.items():
    keys = prepare(OUT/'source'/f'{name}.png')
    # The blink poses would need a face rig to interpolate without double eyes.
    # Skip those individual keys; retain all four narrative beats.
    sequence = [i for i in range(16) if i not in {'wallet-review': [12], 'merchant-match':[14], 'priority-pick':[12,13], 'clean-month':[]}[name]]
    if name == 'clean-month':
        sequence = [0,1,2,3,4,5,6,7,9,10,12,13]
    keys = [keys[i] for i in sequence]
    count = seconds*FPS
    # 0.6s establishing pose, evolving middle, 0.8s settled ending.
    times = np.linspace(.6, seconds-.8, len(keys))
    cached = []
    for a,b in zip(keys,keys[1:]):
        a,b=pixels(a),pixels(b)
        estimator=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
        f=estimator.calc(gray(a),gray(b),None)
        back=estimator.calc(gray(b),gray(a),None)
        cached.append((a,b,f,back))
    frames=[]
    for idx in range(count):
        t=idx/FPS
        if t <= times[0]: frame=keys[0]
        elif t >= times[-1]: frame=keys[-1]
        else:
            k=int(np.searchsorted(times,t)-1)
            phase=(t-times[k])/(times[k+1]-times[k])
            u=phase*phase*(3-2*phase)
            a,b,f,back=cached[k]
            frame=rgba(warp(a,f,u)*(1-u)+warp(b,back,1-u)*u)
        frames.append(frame)
    rows=math.ceil(count/COLS)
    atlas=Image.new('RGBA',(COLS*CELL,rows*CELL))
    for i,frame in enumerate(frames):
        atlas.alpha_composite(frame.resize((CELL,CELL),Image.Resampling.LANCZOS),((i%COLS)*CELL,(i//COLS)*CELL))
    atlas.save(OUT/f'{name}-atlas.webp',lossless=True,method=4)
    frames[-1].save(OUT/f'{name}-poster.png')
    frames[0].save(OUT/f'{name}.webp',save_all=True,append_images=frames[1:],duration=50,loop=1,quality=88,method=4,minimize_size=True)
    all_frames[name]=frames
    manifest[name]={'durationMs':seconds*1000,'fps':FPS,'frameCount':count,'columns':COLS,'rows':rows,'cellSize':CELL,'loop':False,'atlas':f'{name}-atlas.webp','preview':f'{name}.webp','poster':f'{name}-poster.png'}
    print(name, json.dumps(manifest[name]),flush=True)

(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
# Review all four stories on light AND dark backgrounds.
proof=Image.new('RGB',(SIZE*6,SIZE*4),'#f2f5fb')
for row,(name,frames) in enumerate(all_frames.items()):
    for col,ratio in enumerate([0,.18,.38,.58,.78,.97]):
        frame=frames[round((len(frames)-1)*ratio)]
        if col%2: proof.paste('#152035',(col*SIZE,row*SIZE,(col+1)*SIZE,(row+1)*SIZE))
        proof.paste(frame,(col*SIZE,row*SIZE),frame)
proof.save(OUT/'motion-proof.jpg',quality=93)
# Video proof is a real 14-second timeline; shorter stories hold their endings.
import subprocess
p=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s','1024x512','-r',str(FPS),'-i','-','-an','-c:v','libx264','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'kuponi-four-stories.mp4')],stdin=subprocess.PIPE)
for i in range(14*FPS):
    canvas=Image.new('RGB',(1024,512),'#f2f5fb')
    canvas.paste('#152035',(0,256,1024,512))
    for j,frames in enumerate(all_frames.values()):
        frame=frames[min(i,len(frames)-1)]
        canvas.paste(frame,(j*SIZE,0),frame)
        canvas.paste(frame,(j*SIZE,SIZE),frame)
    p.stdin.write(canvas.tobytes())
p.stdin.close()
assert p.wait()==0
