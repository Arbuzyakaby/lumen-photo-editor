/* Lumen render engine.
 * Stage 1 (Canvas 2D): rotate / flip / straighten / crop, plus edge-clamped blur.
 * Stage 2 (WebGL): the whole color pipeline in one fragment shader.
 */
window.Engine = (() => {
  'use strict';

  const ASPECTS = { orig: null, '1:1': 1, '4:5': 4 / 5, '3:2': 3 / 2, '16:9': 16 / 9, '9:16': 9 / 16 };
  const hasFilter = 'filter' in CanvasRenderingContext2D.prototype;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const VS = 'attribute vec2 p;varying vec2 v_uv;void main(){v_uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const FS = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_tex, u_lut;
uniform vec2 u_px, u_res;
uniform float u_exp,u_bri,u_hi,u_sh,u_con,u_brt,u_blk,u_sat,u_vib,u_warm,u_tint,u_hue,u_sharp,u_clar,u_fade,u_vig,u_grain,u_sepia,u_gray,u_gs;
uniform float u_curve,u_hslOn,u_clip,u_bal;
uniform vec3 u_hsl[8];
uniform float u_bh[8];
uniform vec3 u_shT,u_hiT;
uniform float u_jpeg,u_thermal,u_gb,u_vhs,u_acid,u_pixel,u_nv;
vec2 uv;
float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 tx(vec2 o){return texture2D(u_tex,uv+o*u_px).rgb;}
vec3 txa(vec2 p){return texture2D(u_tex,p).rgb;}
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec3 rot(vec3 c,float a){vec3 k=vec3(.57735);float ca=cos(a);return c*ca+cross(k,c)*sin(a)+k*dot(k,c)*(1.-ca);}
float hueOf(vec3 c){
  float mx=max(c.r,max(c.g,c.b)),d=mx-min(c.r,min(c.g,c.b));
  if(d<1e-5)return 0.;
  float h=mx==c.r?mod((c.g-c.b)/d,6.):mx==c.g?(c.b-c.r)/d+2.:(c.r-c.g)/d+4.;
  return h*60.;
}
vec4 lutAt(float x){return texture2D(u_lut,vec2(clamp(x,0.,1.)*.99609375+.001953125,.5));}
vec3 thermal(float t){
  t=clamp(t,0.,1.)*4.;
  vec3 a=vec3(.02,0.,.12),b=vec3(.35,0.,.62),c=vec3(.93,.05,.32),d=vec3(1.,.58,0.),e=vec3(1.,1.,.7);
  return t<1.?mix(a,b,t):t<2.?mix(b,c,t-1.):t<3.?mix(c,d,t-2.):mix(d,e,t-3.);
}
float bayer2(vec2 a){a=floor(a);return fract(dot(a,vec2(.5,a.y*.75)));}
float bayer4(vec2 a){return bayer2(.5*a)*.25+bayer2(a);}
void main(){
  uv=v_uv;
  float big=max(u_res.x,u_res.y),blk=0.;
  if(u_pixel>0.)blk=mix(2.,big/38.,u_pixel*u_pixel);
  if(u_gb>0.)blk=max(blk,big/mix(900.,200.,u_gb));
  if(blk>1.){vec2 cell=u_res/blk;uv=(floor(v_uv*cell)+.5)/cell;}
  if(u_vhs>0.){float ln=floor(v_uv.y*u_res.y/(3.*u_gs));uv.x+=(hash(vec2(ln,7.))-.5)*u_vhs*.005+sin(v_uv.y*38.)*.0018*u_vhs;}
  vec3 c=tx(vec2(0.));
  if(u_vhs>0.){vec2 o=vec2(u_vhs*.0055,0.);c.r=txa(uv+o).r;c.b=txa(uv-o).b;}
  if(u_jpeg>0.){
    float bs=mix(4.,18.,u_jpeg)*max(1.,big/1400.);
    vec2 cell=u_res/bs,buv=(floor(uv*cell)+.5)/cell;
    vec3 cb=(txa(buv)+txa(buv+vec2(.3,.3)/cell)+txa(buv-vec2(.3,.3)/cell)+txa(buv+vec2(.3,-.3)/cell))*.25;
    float lv=mix(40.,4.,u_jpeg),l0=luma(c),lb=luma(cb);
    float lq=floor(mix(l0,lb,u_jpeg*.55)*lv+.5)/lv;
    float rn=(hash(floor(uv*u_res/(2.*u_gs))+floor(uv*cell)*3.1)-.5)*.14*u_jpeg;
    c=mix(c,vec3(lq+rn)+(cb-lb)*(1.+u_jpeg),clamp(u_jpeg*1.5,0.,1.));
  }
  if(u_sharp>0.){
    vec3 b=(tx(vec2(1.,0.))+tx(vec2(-1.,0.))+tx(vec2(0.,1.))+tx(vec2(0.,-1.)))*.25;
    c+=(c-b)*u_sharp*2.2;
  }
  if(u_clar!=0.){
    float r=big/160.;
    vec3 b=vec3(0.);
    for(int i=0;i<12;i++){float a=float(i)*.5236;vec2 d=vec2(cos(a),sin(a));b+=tx(d*r)+tx(d*r*.45);}
    b/=24.;
    float l0=luma(c);
    c+=(l0-luma(b))*u_clar*1.6*(1.-pow(abs(l0*2.-1.),2.));
  }
  c=max(c,0.);
  c*=exp2(u_exp*1.5);
  float l=luma(c);
  c*=1.+u_bri*(.55*(1.-l)*(1.-l)-.25*l*l);
  l=luma(c);
  float hw=smoothstep(.45,1.,l),sw=1.-smoothstep(0.,.55,l);
  c+=(u_sh*sw*.42+u_hi*hw*.38)*clamp((c+.05)/(l+.05),0.,2.);
  c=u_brt>=0.?c+(1.-c)*u_brt*.3:c*(1.+u_brt*.3);
  float bp=u_blk*.12;c=(c-bp)/(1.-bp);
  c=(c-.5)*(1.+u_con*.85)+.5;
  c*=vec3(1.+u_warm*.16+u_tint*.05,1.-u_tint*.12,1.-u_warm*.16+u_tint*.05);
  if(u_hue!=0.)c=rot(c,u_hue);
  if(u_hslOn>0.){
    vec3 q=clamp(c,0.,1.);
    float h=hueOf(q),ch=max(q.r,max(q.g,q.b))-min(q.r,min(q.g,q.b));
    vec3 acc=vec3(0.);float ws=0.;
    for(int i=0;i<8;i++){float d=abs(h-u_bh[i]);d=min(d,360.-d);float w=1.-smoothstep(0.,48.,d);acc+=w*u_hsl[i];ws+=w;}
    acc/=max(ws,1.);
    float wt=smoothstep(0.,.14,ch);
    c=rot(c,acc.x*wt);
    c=mix(vec3(luma(c)),c,1.+acc.y*wt);
    c*=1.+acc.z*wt*.55;
  }
  l=luma(c);
  c=mix(vec3(l),c,1.+u_sat);
  float mx=max(c.r,max(c.g,c.b)),mn=min(c.r,min(c.g,c.b));
  c=mix(vec3(l),c,1.+u_vib*(1.-clamp(mx-mn,0.,1.))*1.3);
  if(u_curve>0.){c=clamp(c,0.,1.);c=vec3(lutAt(c.r).r,lutAt(c.g).g,lutAt(c.b).b);}
  if(u_shT!=vec3(0.)||u_hiT!=vec3(0.)){
    float lg=clamp(luma(c),0.,1.);
    c+=u_shT*(1.-smoothstep(0.,.62+u_bal*.3,lg))+u_hiT*smoothstep(.38+u_bal*.3,1.,lg);
  }
  vec3 sp=vec3(dot(c,vec3(.393,.769,.189)),dot(c,vec3(.349,.686,.168)),dot(c,vec3(.272,.534,.131)));
  c=mix(c,sp,u_sepia);
  c=mix(c,vec3(luma(c)),u_gray);
  c=mix(c,c*.8+.11,u_fade);
  if(u_acid>0.){float la=luma(c);c=rot(c,u_acid*(la*9.4+v_uv.x*3.1+v_uv.y*2.3));c=mix(vec3(luma(c)),c,1.+u_acid*1.3);}
  if(u_thermal>0.)c=mix(c,thermal(luma(clamp(c,0.,1.))),u_thermal);
  if(u_gb>0.){
    vec2 cp=floor(gl_FragCoord.xy/max(1.,blk));
    float t=clamp(luma(clamp(c,0.,1.))+(bayer4(mod(cp,4.))-.5)*.28,0.,1.);
    float s=floor(t*3.999);
    vec3 g=s<1.?vec3(.06,.22,.06):s<2.?vec3(.19,.38,.19):s<3.?vec3(.55,.67,.06):vec3(.61,.74,.06);
    c=mix(c,g,u_gb);
  }
  vec2 asp=vec2(u_res.x/u_res.y,1.);
  if(u_nv>0.){
    float ln=pow(clamp(luma(clamp(c,0.,1.))*1.7+.04,0.,1.),.8);
    vec3 g=vec3(.12,1.,.22)*(ln+(hash(gl_FragCoord.xy*.7)-.5)*.3)*(.86+.14*sin(gl_FragCoord.y*1.6/u_gs));
    vec2 e=(v_uv-.5)*asp;
    float rr=min(length(e-vec2(asp.x*.2,0.)),length(e+vec2(asp.x*.2,0.)));
    g*=smoothstep(.5,.42,rr);
    c=mix(c,g,u_nv);
  }
  if(u_vhs>0.){
    c=mix(c,vec3(luma(c))*vec3(1.07,1.,.86)+c*.25,u_vhs*.3);
    c*=1.-u_vhs*.14*step(.5,fract(gl_FragCoord.y/(2.*u_gs)));
    float tr=smoothstep(.025,0.,abs(v_uv.y-.1));
    c+=tr*u_vhs*(hash(vec2(floor(gl_FragCoord.x/(3.*u_gs)),floor(gl_FragCoord.y/u_gs)))*.6);
  }
  float vd=length((v_uv-.5)*asp)/length(asp*.5);
  float m=smoothstep(.3,1.05,vd);
  if(u_vig>0.)c*=1.-m*u_vig*.85;else c=mix(c,vec3(1.),m*-u_vig*.6);
  c=clamp(c,0.,1.);
  if(u_clip>0.){
    float cx=max(c.r,max(c.g,c.b));
    if(cx>=.996&&luma(c)>.8)c=mix(c,vec3(1.,.12,.1),.85);else if(cx<=.02)c=mix(c,vec3(.08,.38,1.),.85);
  }
  float n=hash(floor(gl_FragCoord.xy/u_gs))-.5;
  c+=n*u_grain*.3*(1.-abs(luma(c)*2.-1.)*.6);
  c+=(hash(gl_FragCoord.xy+17.)-.5)/255.;
  gl_FragColor=vec4(clamp(c,0.,1.),1.);
}`;

  const UNI = ['exp', 'bri', 'hi', 'sh', 'con', 'brt', 'blk', 'sat', 'vib', 'warm', 'tint', 'hue', 'sharp', 'clar', 'fade', 'vig', 'grain', 'sepia', 'gray', 'gs', 'px', 'res',
    'curve', 'hslOn', 'clip', 'bal', 'hsl', 'bh', 'shT', 'hiT', 'jpeg', 'thermal', 'gb', 'vhs', 'acid', 'pixel', 'nv'];
  // Fun effects are plain 0–100 settings like sepia: presets blend them by intensity for free.
  const FUN = { jpeg: 'jpeg', thermal: 'thermal', gameboy: 'gb', vhs: 'vhs', acid: 'acid', pixel: 'pixel', nightvision: 'nv' };
  const BAND_H = [0, 30, 58, 115, 180, 225, 272, 318];
  const glc = document.createElement('canvas');
  const loc = {};
  let gl = null, maxTex = 4096, lutKey = '';

  try {
    gl = glc.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
    if (gl) setup();
  } catch (e) {
    console.warn('WebGL недоступен, работаю без цветокоррекции:', e);
    gl = null;
  }

  function identityLut() {
    const a = new Uint8Array(1024);
    for (let i = 0; i < 256; i++) { a[i * 4] = a[i * 4 + 1] = a[i * 4 + 2] = i; a[i * 4 + 3] = 255; }
    return a;
  }

  function setup() {
    const mk = (type, srcText) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, srcText); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const pr = gl.createProgram();
    gl.attachShader(pr, mk(gl.VERTEX_SHADER, VS));
    gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const ap = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(ap);
    gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
    UNI.forEach(u => (loc[u] = gl.getUniformLocation(pr, 'u_' + u)));
    const mkTex = () => {
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };
    // Unit 1 holds the 256×1 curve table; unit 0 stays bound to the frame for every upload.
    gl.activeTexture(gl.TEXTURE1);
    mkTex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, identityLut());
    gl.activeTexture(gl.TEXTURE0);
    mkTex();
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.uniform1i(gl.getUniformLocation(pr, 'u_tex'), 0);
    gl.uniform1i(gl.getUniformLocation(pr, 'u_lut'), 1);
    gl.uniform1fv(loc.bh, new Float32Array(BAND_H));
    maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  }

  // ---------- Geometry ----------
  const geo = document.createElement('canvas');
  const tmp = document.createElement('canvas');
  const pad = document.createElement('canvas');
  const ids = new WeakMap();
  let nid = 0, geoKey = '', texKey = '';
  const idOf = o => { if (!ids.has(o)) ids.set(o, ++nid); return ids.get(o); };

  function layout(img, s) {
    const sw = img.width, sh = img.height, odd = s.rot % 2 === 1;
    const iw = odd ? sh : sw, ih = odd ? sw : sh;
    let cw = iw, ch = ih;
    const r = ASPECTS[s.aspect];
    if (r) { if (iw / ih > r) cw = ih * r; else ch = iw / r; }
    return { sw, sh, iw, ih, cw, ch };
  }

  function paintGeo(ctx, img, s, L, k, W, H) {
    const a = s.straighten * Math.PI / 180, c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
    // Scale so the straightened image always covers the whole crop — no black corners.
    const fill = Math.max((L.cw * c + L.ch * sn) / L.iw, (L.cw * sn + L.ch * c) / L.ih);
    // Whatever the crop leaves over is slack the frame may slide within: ox/oy are −1…1 of it,
    // positive meaning the crop window moves right/down, so the picture shifts the other way.
    const slackX = Math.max(0, (L.iw * fill - L.cw) * k) / 2;
    const slackY = Math.max(0, (L.ih * fill - L.ch) * k) / 2;
    ctx.save();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(W / 2, H / 2);
    ctx.translate(-clamp(s.ox || 0, -1, 1) * slackX, -clamp(s.oy || 0, -1, 1) * slackY);
    ctx.scale(s.flipH ? -1 : 1, s.flipV ? -1 : 1);
    ctx.rotate(a + s.rot * Math.PI / 2);
    ctx.scale(k * fill, k * fill);
    ctx.drawImage(img, -L.sw / 2, -L.sh / 2);
    ctx.restore();
  }

  function buildGeo(img, s, maxDim) {
    const L = layout(img, s), k = Math.min(1, maxDim / Math.max(L.cw, L.ch));
    const W = Math.max(1, Math.round(L.cw * k)), H = Math.max(1, Math.round(L.ch * k));
    const blur = (s.blur || 0) / 100 * Math.max(W, H) / 70;
    const key = [idOf(img), s.rot, s.flipH, s.flipV, s.straighten, s.aspect, s.ox || 0, s.oy || 0, Math.round(blur * 10), maxDim].join('|');
    if (key === geoKey && geo.width === W && geo.height === H) return false;
    geoKey = key;
    geo.width = W; geo.height = H;
    const g = geo.getContext('2d');
    if (blur < 0.3) { paintGeo(g, img, s, L, k, W, H); return true; }

    // Blur without zoom and without dark edges: extend the border pixels outward first,
    // blur the padded copy, then take back exactly the original frame.
    tmp.width = W; tmp.height = H;
    paintGeo(tmp.getContext('2d'), img, s, L, k, W, H);
    const p = Math.ceil(blur * 2.5) + 2;
    pad.width = W + 2 * p; pad.height = H + 2 * p;
    const x = pad.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(tmp, p, p);
    x.drawImage(tmp, 0, 0, W, 1, p, 0, W, p);
    x.drawImage(tmp, 0, H - 1, W, 1, p, H + p, W, p);
    x.drawImage(tmp, 0, 0, 1, H, 0, p, p, H);
    x.drawImage(tmp, W - 1, 0, 1, H, W + p, p, p, H);
    x.drawImage(tmp, 0, 0, 1, 1, 0, 0, p, p);
    x.drawImage(tmp, W - 1, 0, 1, 1, W + p, 0, p, p);
    x.drawImage(tmp, 0, H - 1, 1, 1, 0, H + p, p, p);
    x.drawImage(tmp, W - 1, H - 1, 1, 1, W + p, H + p, p, p);
    if (hasFilter) {
      g.filter = `blur(${blur}px)`;
      g.drawImage(pad, -p, -p);
      g.filter = 'none';
    } else {
      const f = Math.max(2, blur / 2), sm = document.createElement('canvas');
      sm.width = Math.max(1, Math.round(pad.width / f)); sm.height = Math.max(1, Math.round(pad.height / f));
      sm.getContext('2d').drawImage(pad, 0, 0, sm.width, sm.height);
      g.imageSmoothingQuality = 'high';
      g.drawImage(sm, -p, -p, pad.width, pad.height);
    }
    return true;
  }

  const maxSize = () => Math.min(maxTex, 8192);

  /** Render `img` with effective state `s` into a 2D `target` canvas, longest side ≤ maxDim. */
  function render(target, img, s, maxDim, neutral) {
    maxDim = Math.min(maxDim, maxSize());
    const changed = buildGeo(img, neutral ? { ...s, blur: 0 } : s, maxDim);
    const W = geo.width, H = geo.height;
    if (target.width !== W || target.height !== H) { target.width = W; target.height = H; }
    const t = target.getContext('2d');
    if (neutral || !gl) { t.drawImage(geo, 0, 0); return target; }

    if (glc.width !== W || glc.height !== H) { glc.width = W; glc.height = H; }
    gl.viewport(0, 0, W, H);
    if (changed || texKey !== geoKey) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, geo);
      texKey = geoKey;
    }
    const u = (n, v) => gl.uniform1f(loc[n], v);
    u('exp', s.exposure / 100); u('bri', s.brilliance / 100); u('hi', s.highlights / 100); u('sh', s.shadows / 100);
    u('con', s.contrast / 100); u('brt', s.brightness / 100); u('blk', s.blacks / 100);
    u('sat', s.saturation / 100); u('vib', s.vibrance / 100); u('warm', s.warmth / 100); u('tint', s.tint / 100);
    u('hue', s.hue * Math.PI / 180); u('sharp', s.sharpness / 100); u('clar', s.clarity / 100);
    u('fade', s.fade / 100); u('vig', s.vignette / 100); u('grain', s.grain / 100);
    u('sepia', s.sepia / 100); u('gray', s.gray / 100);
    u('gs', Math.max(1, Math.max(W, H) / 1800));
    for (const k in FUN) u(FUN[k], (s[k] || 0) / 100);
    u('clip', s.clip ? 1 : 0);
    // Curves: the table only goes up to the GPU when the curve itself changed.
    u('curve', s.lut ? 1 : 0);
    if (s.lut && s.lutKey !== lutKey) {
      gl.activeTexture(gl.TEXTURE1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, s.lut);
      gl.activeTexture(gl.TEXTURE0);
      lutKey = s.lutKey;
    }
    u('hslOn', s.hslU ? 1 : 0);
    if (s.hslU) gl.uniform3fv(loc.hsl, s.hslU);
    const sh = s.shT || [0, 0, 0], hi = s.hiT || [0, 0, 0];
    gl.uniform3f(loc.shT, sh[0], sh[1], sh[2]);
    gl.uniform3f(loc.hiT, hi[0], hi[1], hi[2]);
    u('bal', (s.gBal || 0) / 100);
    gl.uniform2f(loc.px, 1 / W, 1 / H);
    gl.uniform2f(loc.res, W, H);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    t.drawImage(glc, 0, 0);
    return target;
  }

  return { render, layout, maxSize, ASPECTS, FUN, webgl: !!gl };
})();
