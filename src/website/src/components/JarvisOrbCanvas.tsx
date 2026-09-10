'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { OrbState } from '@/lib/types'

export type { OrbState }

interface Props {
  state?: OrbState
  audioLevel?: number
  className?: string
}

type OrbConfig = {
  color: number
  accentColor: number
  timeSpeed: number
  chromaticAberration: number
  pulsate: boolean
  layerOpacity: [number, number, number]
}

const STATE_CONFIGS: Record<OrbState, OrbConfig> = {
  idle:      { color: 0x1144aa, accentColor: 0x00aaff, timeSpeed: 0.012, chromaticAberration: 0.6, pulsate: false, layerOpacity: [0.18, 0.22, 0.38] },
  listening: { color: 0x0066ff, accentColor: 0x44ccff, timeSpeed: 0.022, chromaticAberration: 1.2, pulsate: true,  layerOpacity: [0.22, 0.28, 0.45] },
  thinking:  { color: 0x7700ff, accentColor: 0xcc44ff, timeSpeed: 0.020, chromaticAberration: 0.8, pulsate: true,  layerOpacity: [0.20, 0.25, 0.42] },
  speaking:  { color: 0x00aa55, accentColor: 0x44ffaa, timeSpeed: 0.027, chromaticAberration: 1.5, pulsate: true,  layerOpacity: [0.22, 0.28, 0.48] },
  error:     { color: 0x880000, accentColor: 0xff4444, timeSpeed: 0.008, chromaticAberration: 0.4, pulsate: false, layerOpacity: [0.15, 0.18, 0.30] },
}

const VERTEX = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  uniform float time;
  uniform float audioLevel;
  uniform float layerOffset;

  vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
  vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
  vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1./6.,1./3.);
    const vec4 D=vec4(0.,.5,1.,2.);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.+1.;
    vec4 s1=floor(b1)*2.+1.;
    vec4 sh=-step(h,vec4(0.));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
    m=m*m;
    return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  void main(){
    vUv=uv;
    vNormal=normalize(normalMatrix*normal);
    vec3 pos=position;
    float w1=sin(pos.y*2.5+time*1.5+layerOffset)*cos(pos.x*2.-time*1.2);
    float w2=sin(pos.x*3.-time*1.8+layerOffset)*cos(pos.z*2.5+time*1.5);
    float w3=sin(pos.z*2.8+time*1.6+layerOffset)*cos(pos.y*2.3-time*1.3);
    float n1=snoise(pos*1.2+time*0.3+layerOffset);
    float n2=snoise(pos*2.-time*0.2+layerOffset*0.5);
    float d=(w1+w2+w3)*0.008+(n1*0.008+n2*0.007);
    d*=(0.3+audioLevel*0.6);
    pos+=normal*d;
    vPosition=pos;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.);
  }
`

const FRAGMENT = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  uniform vec3 sphereColor;
  uniform float opacity;
  uniform float time;
  uniform float chromaticAberration;

  vec3 rgb2hsv(vec3 c){
    vec4 K=vec4(0.,-1./3.,2./3.,-1.);
    vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
    vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
    float d=q.x-min(q.w,q.y);
    float e=1.e-10;
    return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);
  }
  vec3 hsv2rgb(vec3 c){
    vec4 K=vec4(1.,2./3.,1./3.,3.);
    vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www);
    return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y);
  }

  void main(){
    vec3 viewDir=normalize(cameraPosition-vPosition);
    float fresnel=pow(1.-abs(dot(viewDir,normalize(vNormal))),2.);
    vec3 nw=normalize(vNormal);
    float rs=nw.x*0.5+nw.y*0.2+nw.z*0.1;
    rs+=sin(vPosition.x*5.+time*0.5)*0.01+cos(vPosition.y*4.-time*0.3)*0.01;
    rs=fract(rs);
    vec3 rainbow=hsv2rgb(vec3(rs,0.8,1.));
    vec3 hsv=rgb2hsv(sphereColor);
    float ab=chromaticAberration*fresnel;
    vec3 hR=hsv;hR.x=fract(hsv.x+ab*0.15);vec3 cR=hsv2rgb(hR);
    vec3 hB=hsv;hB.x=fract(hsv.x-ab*0.15);vec3 cB=hsv2rgb(hB);
    vec3 color=vec3(cR.r,sphereColor.g,cB.b);
    float hi=fresnel*0.6+0.2;
    color=mix(color,rainbow,hi*0.6);
    color+=fresnel*chromaticAberration*0.15;
    float brt=1.+sin(vPosition.x*3.+time)*0.1+sin(vPosition.y*2.5-time*0.8)*0.1;
    float shimmer=sin(vPosition.x*8.+vPosition.y*6.+time*2.)*0.04+0.96;
    color*=brt*shimmer;
    gl_FragColor=vec4(color,opacity);
  }
`

export default function JarvisOrbCanvas({ state = 'idle', audioLevel = 0, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef({ state, audioLevel })
  stateRef.current = { state, audioLevel }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
    camera.position.z = 3.5

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)

    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // Layered spheres
    type Layer = { mesh: THREE.Mesh; baseScale: number; rotSpeed: { x: number; y: number; z: number } }
    const layers: Layer[] = [
      { baseScale: 1.00, rotSpeed: { x: 0.001, y: 0.002, z: 0 } },
      { baseScale: 0.85, rotSpeed: { x: -0.002, y: 0.003, z: 0.001 } },
      { baseScale: 0.70, rotSpeed: { x: 0.003, y: -0.002, z: -0.001 } },
    ].map((cfg, i) => {
      const geo = new THREE.SphereGeometry(cfg.baseScale, 80, 80)
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          time: { value: 0 },
          audioLevel: { value: 0 },
          layerOffset: { value: i * 2.0 },
          sphereColor: { value: new THREE.Color(STATE_CONFIGS.idle.color) },
          opacity: { value: STATE_CONFIGS.idle.layerOpacity[i] },
          chromaticAberration: { value: STATE_CONFIGS.idle.chromaticAberration },
          cameraPosition: { value: camera.position },
        },
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(geo, mat)
      scene.add(mesh)
      return { mesh, baseScale: cfg.baseScale, rotSpeed: cfg.rotSpeed }
    })

    // Waveform bars ring
    const BAR_COUNT = 48
    const BAR_RADIUS = 1.6
    const bars: THREE.Mesh[] = []
    const barGeo = new THREE.BoxGeometry(0.04, 0.4, 0.02)
    for (let i = 0; i < BAR_COUNT; i++) {
      const angle = (i / BAR_COUNT) * Math.PI * 2
      const mat = new THREE.MeshBasicMaterial({ color: 0x0066aa, transparent: true, opacity: 0.5 })
      const mesh = new THREE.Mesh(barGeo, mat)
      mesh.position.set(Math.cos(angle) * BAR_RADIUS, 0, Math.sin(angle) * BAR_RADIUS)
      mesh.rotation.y = -angle + Math.PI / 2
      scene.add(mesh)
      bars.push(mesh)
    }

    // Outer glow ring
    const ringGeo = new THREE.RingGeometry(1.55, 1.65, 64)
    ringGeo.rotateX(Math.PI / 2)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x0044aa, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    scene.add(ring)

    // Ambient lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.3))
    const pt1 = new THREE.PointLight(0x0066ff, 0.6, 10)
    pt1.position.set(3, 3, 3)
    scene.add(pt1)
    const pt2 = new THREE.PointLight(0x4400aa, 0.4, 10)
    pt2.position.set(-3, -3, 3)
    scene.add(pt2)

    let raf = 0
    let timeAcc = 0
    let currentScale = 1.0
    let targetScale = 1.0
    const simState = { intensity: 0.5, nextChange: 0 }

    const animate = (now: number) => {
      raf = requestAnimationFrame(animate)
      const { state: s, audioLevel: al } = stateRef.current
      const cfg = STATE_CONFIGS[s]

      timeAcc += cfg.timeSpeed

      // Simulated audio for demo
      let effAudio = al
      if (al < 0.01 && s !== 'idle') {
        const t = now * 0.001
        if (t > simState.nextChange) {
          simState.intensity = 0.3 + Math.random() * 0.5
          simState.nextChange = t + 0.1 + Math.random() * 0.3
        }
        effAudio = Math.max(0, simState.intensity + Math.sin(t * 8) * 0.08)
      }

      // Pulsate
      if (cfg.pulsate) {
        if (s === 'thinking') {
          const t = now * 0.001
          targetScale = 1.0 + 0.05 + (Math.sin(t * 1.5) + 1) / 2 * 0.1
        } else {
          targetScale = 1.0 + 0.02 + effAudio * 0.18
        }
      } else {
        targetScale = 1.0
      }
      currentScale += (targetScale - currentScale) * 0.15

      layers.forEach(({ mesh, baseScale, rotSpeed }, i) => {
        const mat = mesh.material as THREE.ShaderMaterial
        mat.uniforms.time.value = timeAcc
        mat.uniforms.audioLevel.value = effAudio
        mat.uniforms.sphereColor.value.setHex(cfg.color)
        mat.uniforms.opacity.value = cfg.layerOpacity[i]
        mat.uniforms.chromaticAberration.value = cfg.chromaticAberration
        mesh.rotation.x += rotSpeed.x
        mesh.rotation.y += rotSpeed.y
        mesh.rotation.z += rotSpeed.z
        const sc = baseScale * currentScale
        mesh.scale.set(sc, sc, sc)
      })

      // Animate waveform bars
      const t = now * 0.001
      ring.rotation.y = t * 0.3
      bars.forEach((bar, i) => {
        const mat = bar.material as THREE.MeshBasicMaterial
        const phase = (i / BAR_COUNT) * Math.PI * 4
        const h = s === 'idle'
          ? 0.05 + Math.sin(t * 0.5 + phase) * 0.02
          : 0.05 + Math.sin(t * 2 + phase) * 0.25 * (0.5 + effAudio * 0.5) + effAudio * 0.15
        bar.scale.y = Math.max(0.05, h * 2.5)
        bar.position.y = h * 0.5
        mat.color.setHex(s === 'idle' ? 0x224466 : cfg.accentColor)
        mat.opacity = s === 'idle' ? 0.3 : 0.5 + h * 0.4
      });

      (ringMat as THREE.MeshBasicMaterial).color.setHex(cfg.accentColor)
      ringMat.opacity = 0.2 + effAudio * 0.2

      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.dispose()
      layers.forEach(l => { l.mesh.geometry.dispose(); (l.mesh.material as THREE.Material).dispose() })
    }
  }, [])

  return <canvas ref={canvasRef} className={`w-full h-full ${className}`} style={{ background: 'transparent' }} />
}
