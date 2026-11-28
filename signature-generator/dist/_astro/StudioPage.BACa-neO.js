import{t as e}from"./react.CD6hyuMb.js";import{a as t,i as n,n as r,o as i,r as a,t as o}from"./nyuchi.D_S-VYy1.js";var s=e();async function c(e,n=fetch){let r=[];for(let i of Object.values(t))for(let t of[`light`,`dark`]){let a=i.icon[t];!a||!a.endsWith(`.png`)||r.push(n(a.replace(/\.png$/,`.b64.txt`)).then(e=>e.ok?e.text():Promise.reject(Error(`${a}: ${e.status}`))).then(n=>e(i.key,`data:image/png;base64,`+n.trim(),t)).catch(()=>{}))}await Promise.all(r)}var l=i(),u=({active:e,onPick:t,categories:n})=>(0,l.jsx)(`div`,{className:`ns-palette`,children:Object.entries(n).map(([n,r])=>(0,l.jsxs)(`button`,{type:`button`,className:`ns-swatch-chip`+(n===e?` active`:``),title:r.name+` · `+r.role,onClick:()=>t(n),children:[(0,l.jsx)(`span`,{className:`ns-chip-color`,style:{background:`linear-gradient(135deg, ${r.dark} 0 50%, ${r.light} 50% 100%)`}}),(0,l.jsx)(`span`,{className:`ns-chip-name`,children:r.name})]},n))}),d=[{v:`ig`,label:`Square`},{v:`story`,label:`Story`},{v:`16x9`,label:`16:9`},{v:`og`,label:`OG`},{v:`li`,label:`LinkedIn`}],f=[{v:5,label:`Mineral`},{v:1,label:`Type`},{v:2,label:`Anchor`},{v:3,label:`Split`},{v:4,label:`Halo`}],p=[{v:`diagonal`,label:`Diagonal`},{v:`steep`,label:`Steep`},{v:`chevron`,label:`Chevron`}],m=[{v:`auto`,label:`Auto`},{v:`light`,label:`Light`},{v:`dark`,label:`Dark`},{v:`accent`,label:`Accent`}],h=[{v:`nyuchi`,label:`nyuchi.com`},{v:`bundu`,label:`bundu.org`},{v:`mukoko`,label:`mukoko.com`},{v:`shamwari`,label:`shamwari.ai`}];function g(e){return(0,l.jsx)(`div`,{className:`ns-seg`,children:e.options.map(t=>(0,l.jsx)(`button`,{type:`button`,className:t.v===e.value?`active`:``,onClick:()=>e.onChange(t.v),children:t.label},String(t.v)))})}var _=({state:e,setState:t,onLoadMineral:n,onDownloadPng:r,onDownloadSvg:i,onShuffle:a,pngBusy:s})=>{let c=(e,n)=>t(t=>({...t,[e]:n}));return(0,l.jsxs)(`aside`,{className:`ns-panel`,children:[(0,l.jsx)(`h1`,{children:`Nyuchi Studio`}),(0,l.jsx)(`span`,{className:`ns-tag`,children:`social cards · 7 minerals · one system`}),(0,l.jsxs)(`div`,{className:`ns-grp`,children:[(0,l.jsx)(`h2`,{children:`Content`}),(0,l.jsxs)(`label`,{children:[`Eyebrow `,(0,l.jsx)(`span`,{style:{opacity:.6},children:`(optional — defaults to palette)`})]}),(0,l.jsx)(`input`,{type:`text`,value:e.eyebrow,placeholder:`Cobalt · Knowledge`,onChange:e=>c(`eyebrow`,e.target.value)}),(0,l.jsx)(`label`,{children:`Title`}),(0,l.jsx)(`textarea`,{rows:2,value:e.title,onChange:e=>c(`title`,e.target.value)}),(0,l.jsx)(`label`,{children:`Subtitle / description`}),(0,l.jsx)(`textarea`,{rows:3,value:e.dek,onChange:e=>c(`dek`,e.target.value)}),(0,l.jsxs)(`div`,{className:`ns-two`,children:[(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`label`,{children:`Index`}),(0,l.jsx)(`input`,{type:`text`,value:e.index,placeholder:`01`,onChange:e=>c(`index`,e.target.value)})]}),(0,l.jsxs)(`div`,{style:{flex:2.4},children:[(0,l.jsx)(`label`,{children:`Footnote / origin`}),(0,l.jsx)(`input`,{type:`text`,value:e.footnote,placeholder:`Katanga Copperbelt · DRC`,onChange:e=>c(`footnote`,e.target.value)})]})]})]}),(0,l.jsxs)(`div`,{className:`ns-grp`,children:[(0,l.jsx)(`h2`,{children:`Palette`}),(0,l.jsx)(u,{active:e.category,onPick:e=>c(`category`,e),categories:o}),(0,l.jsx)(`button`,{type:`button`,className:`ns-act sec`,style:{marginTop:10},onClick:n,children:`↩ Load this mineral's copy`}),(0,l.jsx)(`div`,{className:`ns-hint`,children:`Pick a palette for any card. "Load copy" fills the fields with that mineral's story and switches to the Mineral layout.`})]}),(0,l.jsxs)(`div`,{className:`ns-grp`,children:[(0,l.jsx)(`h2`,{children:`Format`}),(0,l.jsx)(g,{value:e.format,options:d,onChange:e=>c(`format`,e)}),(0,l.jsx)(`label`,{style:{marginTop:11},children:`Layout`}),(0,l.jsx)(g,{value:e.layout,options:f,onChange:e=>c(`layout`,e)})]}),e.layout===5&&(0,l.jsxs)(`div`,{className:`ns-grp`,children:[(0,l.jsx)(`h2`,{children:`Mineral swatch`}),(0,l.jsx)(g,{value:e.facet,options:p,onChange:e=>c(`facet`,e)}),(0,l.jsxs)(`div`,{className:`ns-lab-row`,children:[(0,l.jsx)(`label`,{children:`Cleave angle`}),(0,l.jsx)(`span`,{style:{color:`var(--ns-accent)`,fontFamily:`var(--font-mono)`,fontSize:11},children:e.angle})]}),(0,l.jsx)(`input`,{type:`range`,min:20,max:80,value:e.angle,onChange:e=>c(`angle`,Number(e.target.value))}),(0,l.jsxs)(`label`,{className:`ns-chk`,children:[(0,l.jsx)(`input`,{type:`checkbox`,checked:e.cleave,onChange:e=>c(`cleave`,e.target.checked)}),` `,`Show cleavage line`]})]}),(0,l.jsxs)(`div`,{className:`ns-grp`,children:[(0,l.jsx)(`h2`,{children:`Surface & brand`}),(0,l.jsx)(g,{value:e.theme,options:m,onChange:e=>c(`theme`,e)}),(0,l.jsx)(`label`,{style:{marginTop:11},children:`Lockup mark`}),(0,l.jsx)(g,{value:e.brand,options:h,onChange:e=>c(`brand`,e)}),(0,l.jsxs)(`label`,{className:`ns-chk`,children:[(0,l.jsx)(`input`,{type:`checkbox`,checked:e.lockup,onChange:e=>c(`lockup`,e.target.checked)}),` `,`Show logo lockup`]}),(0,l.jsxs)(`label`,{className:`ns-chk`,children:[(0,l.jsx)(`input`,{type:`checkbox`,checked:e.lattice,onChange:e=>c(`lattice`,e.target.checked)}),` `,`Engineering grid`]})]}),(0,l.jsxs)(`div`,{className:`ns-grp`,children:[(0,l.jsx)(`h2`,{children:`Export`}),(0,l.jsx)(`button`,{type:`button`,className:`ns-act`,onClick:r,disabled:s,children:s?`Rendering…`:`Download PNG (2×)`}),(0,l.jsx)(`button`,{type:`button`,className:`ns-act sec`,onClick:i,children:`Download SVG`}),(0,l.jsx)(`button`,{type:`button`,className:`ns-act sec`,onClick:a,children:`↻ Reshuffle graph`})]})]})},v=(0,s.forwardRef)(({svg:e,formatW:t,formatH:n,resizeSignal:r},i)=>{let a=(0,s.useRef)(null),[o,c]=(0,s.useState)({dw:320,dh:320}),u=t/n;return(0,s.useEffect)(()=>{let e=a.current;if(!e)return;let t=()=>{let t=e.getBoundingClientRect(),n=getComputedStyle(e),r=parseFloat(n.paddingLeft)||10,i=parseFloat(n.paddingTop)||10,a=t.width-r*2,o=Math.max(220,Math.min(window.innerHeight*.62,t.height-i*2)),s=a,l=s/u;l>o&&(l=o,s=l*u),c(e=>e.dw===s&&e.dh===l?e:{dw:s,dh:l})},n=new ResizeObserver(t);return n.observe(e),typeof document<`u`&&document.fonts?.ready&&document.fonts.ready.then(t).catch(()=>{}),()=>n.disconnect()},[u,r,e]),(0,l.jsx)(`div`,{ref:a,className:`ns-preview-frame`,children:(0,l.jsx)(`div`,{ref:i,className:`ns-card-host`,style:{width:o.dw+`px`,height:o.dh+`px`},dangerouslySetInnerHTML:{__html:e}})})});v.displayName=`StudioPreview`;var y={cobalt:{idx:`01`,role:`Knowledge`,desc:`The mineral in every battery on earth. Our blue of learning and trust.`,origin:`Katanga Copperbelt · DRC & Zambia`},sodalite:{idx:`02`,role:`Intelligence`,desc:`Cobalt's deeper cousin — the colour of a mind reasoning through a hard problem.`,origin:`Kunene River · Namibia & South Africa`},tanzanite:{idx:`03`,role:`Identity`,desc:`A thousand times rarer than diamond, found on a single hillside on earth.`,origin:`Merelani Hills · Tanzania`},malachite:{idx:`04`,role:`Growth`,desc:`The oldest green in the human story. The signal that something is alive and working.`,origin:`Congo Copper Belt`},gold:{idx:`05`,role:`Value`,desc:`The metal and the honey. nyuchi means bee — the reward carried home to the hive.`,origin:`Ghana · South Africa · Mali · Zimbabwe`},copper:{idx:`06`,role:`Stewardship`,desc:`The metal that connects everything. bundu — the ground the rest are dug from.`,origin:`Central African Copperbelt · Zambia & DRC`},terracotta:{idx:`07`,role:`Community`,desc:`Fired clay, the oldest material we build with. Ubuntu — I am because we are.`,origin:`Pan-African Sahel`}},b={eyebrow:``,title:`Seven minerals, one ecosystem`,dek:`How the bundu palette carries meaning across every brand we build.`,index:``,footnote:``,role:``,category:`cobalt`,format:`ig`,layout:5,theme:`auto`,lockup:!0,lattice:!0,brand:`nyuchi`,facet:`diagonal`,angle:62,cleave:!0,salt:0},x={1:`type`,2:`anchor`,3:`split`,4:`halo`,5:`mineral`};function S(e){return e.toLowerCase().replace(/[^a-z0-9]+/g,`-`).replace(/^-|-$/g,``).slice(0,36)||`card`}function C(){return typeof document>`u`?`light`:document.documentElement.getAttribute(`data-theme`)===`dark`?`dark`:`light`}var w=()=>{let[e,t]=(0,s.useState)(b),[i,u]=(0,s.useState)(C),[d,f]=(0,s.useState)(!1);(0,s.useEffect)(()=>{let e=!1;return c(n).then(()=>{e||f(!0)}),()=>{e=!0}},[]);let p=e.theme===`auto`?i:e.theme,m=(0,s.useMemo)(()=>({format:e.format,layout:e.layout,theme:p,category:e.category,eyebrow:e.eyebrow,title:e.title,dek:e.dek,index:e.index,footnote:e.footnote,role:e.role,facet:e.facet,angle:e.angle,cleave:e.cleave,lattice:e.lattice,lockup:e.lockup,brand:e.brand,seedKey:e.title+e.category+e.layout+e.salt}),[e,p]),h=(0,s.useMemo)(()=>r(m),[m,d]),g=(0,s.useCallback)(()=>{let e=C()===`dark`?`light`:`dark`;document.documentElement.setAttribute(`data-theme`,e),localStorage.setItem(`nyuchi-theme`,e),u(e)},[]),w=(0,s.useCallback)(()=>{let t=new Blob([h.svg],{type:`image/svg+xml;charset=utf-8`}),n=URL.createObjectURL(t),r=document.createElement(`a`);r.href=n,r.download=`${S(e.title)}-${e.format}-l${e.layout}.svg`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),2e3)},[h.svg,e.title,e.format,e.layout]),[E,D]=(0,s.useState)(!1),O=(0,s.useCallback)(async()=>{D(!0);try{let t=await a(h.svg,h.format,2),n=URL.createObjectURL(t),r=document.createElement(`a`);r.href=n,r.download=`${S(e.title)}-${e.format}-l${e.layout}.png`,document.body.appendChild(r),r.click(),r.remove(),setTimeout(()=>URL.revokeObjectURL(n),2e3)}catch(e){console.error(e),alert(`Export failed — see console.`)}finally{D(!1)}},[h.svg,h.format,e.title,e.format,e.layout]);(0,s.useEffect)(()=>{if(typeof document>`u`||!(`modelContext`in document))return;let e=new AbortController;return document.modelContext?.registerTool({name:`download_studio_card_svg`,description:`Render and download the current Nyuchi Studio card as an SVG file.`,inputSchema:{type:`object`,properties:{}},execute:async()=>(w(),{status:`downloaded`,format:`svg`}),annotations:{readOnlyHint:!1}},{signal:e.signal}),document.modelContext?.registerTool({name:`download_studio_card_png`,description:`Render and download the current Nyuchi Studio card as a PNG file.`,inputSchema:{type:`object`,properties:{}},execute:async()=>(await O(),{status:`downloaded`,format:`png`}),annotations:{readOnlyHint:!1}},{signal:e.signal}),()=>e.abort()},[w,O]);let k=(0,s.useCallback)(()=>{t(e=>{let t=y[e.category],n=o[e.category];return{...e,title:n.name,dek:t.desc,index:t.idx,footnote:t.origin,role:t.role,eyebrow:``,layout:5}})},[]),A=(0,s.useCallback)(()=>t(e=>({...e,salt:e.salt+1|0})),[]),j=o[e.category],M=p===`light`?j.light:j.dark,N=`seed `+(`00000000`+h.seed.toString(16)).slice(-8),P=`L`+e.layout+` · `+x[e.layout],F=h.format.w*2+` × `+h.format.h*2,I=(0,s.useRef)(null),[L,R]=(0,s.useState)(0);return(0,s.useEffect)(()=>{let e=()=>R(e=>e+1);return window.addEventListener(`resize`,e),()=>window.removeEventListener(`resize`,e)},[]),(0,l.jsxs)(l.Fragment,{children:[(0,l.jsx)(`style`,{children:T}),(0,l.jsxs)(`div`,{className:`nyuchi-studio`,children:[(0,l.jsx)(_,{state:e,setState:t,onLoadMineral:k,onDownloadPng:O,onDownloadSvg:w,onShuffle:A,pngBusy:E}),(0,l.jsxs)(`div`,{className:`ns-stage`,children:[(0,l.jsx)(`div`,{className:`ns-topbar`,children:(0,l.jsx)(`button`,{type:`button`,className:`ns-topbtn`,onClick:g,children:`◐ Theme`})}),(0,l.jsx)(v,{ref:I,svg:h.svg,formatW:h.format.w,formatH:h.format.h,resizeSignal:L}),(0,l.jsxs)(`div`,{className:`ns-meta`,children:[(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`b`,{children:h.format.name}),` · `,(0,l.jsx)(`span`,{children:h.format.label}),` · `,(0,l.jsx)(`span`,{children:P}),(0,l.jsx)(`br`,{}),(0,l.jsxs)(`span`,{children:[(0,l.jsx)(`span`,{className:`ns-dot`,style:{background:M}}),j.name,` · `,e.role||j.role]}),` `,`· `,(0,l.jsx)(`span`,{children:N}),` · export `,(0,l.jsx)(`b`,{children:F})]}),(0,l.jsxs)(`div`,{className:`ns-actions`,children:[(0,l.jsx)(`button`,{type:`button`,className:`ns-btn-act ghost`,onClick:A,"aria-label":`Shuffle`,children:`↻`}),(0,l.jsx)(`button`,{type:`button`,className:`ns-btn-act ghost`,onClick:w,children:`SVG`}),(0,l.jsx)(`button`,{type:`button`,className:`ns-btn-act primary`,onClick:O,disabled:E,children:`PNG`})]})]})]})]})]})},T=`
.nyuchi-studio {
  --ns-fg: var(--foreground);
  --ns-fg2: var(--muted-foreground);
  --ns-bg: var(--background);
  --ns-panel: var(--surface);
  --ns-card: var(--overlay);
  --ns-line: var(--border);
  --ns-accent: var(--color-copper-raw);
  --ns-input: var(--input);
  display: flex;
  min-height: calc(100dvh - 4rem);
  background: var(--ns-bg);
  color: var(--ns-fg);
  font-family: var(--font-sans);
}
.nyuchi-studio *,
.nyuchi-studio *::before,
.nyuchi-studio *::after { box-sizing: border-box; }

/* Panel */
.nyuchi-studio .ns-panel {
  width: 330px; flex-shrink: 0;
  background: var(--ns-panel);
  border-right: 1px solid var(--ns-line);
  padding: 18px 16px;
  overflow-y: auto;
  max-height: calc(100dvh - 4rem);
  position: sticky; top: 4rem;
}
.nyuchi-studio .ns-panel h1 { font-family: var(--font-serif); font-size: 19px; font-weight: 700; margin: 0 0 2px; }
.nyuchi-studio .ns-tag {
  font-family: var(--font-mono); font-size: 10px; color: var(--ns-fg2);
  margin-bottom: 16px; display: block; letter-spacing: .08em;
}
.nyuchi-studio .ns-grp { margin-bottom: 15px; border-bottom: 1px solid var(--ns-line); padding-bottom: 14px; }
.nyuchi-studio .ns-grp:last-child { border: none; margin-bottom: 0; }
.nyuchi-studio .ns-grp h2 {
  font-size: 10px; text-transform: uppercase; letter-spacing: .14em;
  color: var(--ns-fg2); margin-bottom: 9px; font-family: var(--font-mono); font-weight: 600;
}
.nyuchi-studio label { display: block; font-size: 11px; color: var(--ns-fg2); margin: 9px 0 3px; }
.nyuchi-studio .ns-lab-row { display: flex; justify-content: space-between; align-items: baseline; }
.nyuchi-studio input[type=text],
.nyuchi-studio textarea {
  width: 100%; background: var(--ns-input); border: 1px solid var(--ns-line); color: var(--ns-fg);
  border-radius: 10px; padding: 8px 10px; font-family: var(--font-sans); font-size: 13px;
  outline: none; transition: border-color .15s;
}
.nyuchi-studio input[type=text]:focus,
.nyuchi-studio textarea:focus { border-color: var(--ns-accent); }
.nyuchi-studio textarea { resize: vertical; min-height: 44px; line-height: 1.4; }
.nyuchi-studio .ns-two { display: flex; gap: 8px; }
.nyuchi-studio .ns-two > div { flex: 1; }
.nyuchi-studio input[type=range] { width: 100%; accent-color: var(--ns-accent); margin-top: 5px; }

.nyuchi-studio .ns-seg { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 5px; }
.nyuchi-studio .ns-seg button {
  flex: 1; min-width: 46px; background: var(--ns-input); border: 1px solid var(--ns-line);
  color: var(--ns-fg2); border-radius: 999px; padding: 7px 4px; font-size: 10px; font-weight: 600;
  cursor: pointer; font-family: var(--font-mono); letter-spacing: .04em; transition: .12s; white-space: nowrap;
}
.nyuchi-studio .ns-seg button.active { background: var(--ns-accent); color: #1a0d06; border-color: var(--ns-accent); }
.nyuchi-studio .ns-seg button:hover:not(.active) { color: var(--ns-fg); }

.nyuchi-studio .ns-palette { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 5px; }
.nyuchi-studio .ns-swatch-chip {
  display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 2px;
  background: var(--ns-input); border: 1.5px solid transparent; border-radius: 9px; cursor: pointer;
  font-family: var(--font-sans); color: var(--ns-fg); transition: .12s;
}
.nyuchi-studio .ns-swatch-chip .ns-chip-color { width: 100%; height: 22px; border-radius: 5px; }
.nyuchi-studio .ns-swatch-chip .ns-chip-name { font-size: 9px; letter-spacing: .02em; }
.nyuchi-studio .ns-swatch-chip.active { border-color: var(--ns-accent); }

.nyuchi-studio .ns-chk { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 12px; color: var(--ns-fg); cursor: pointer; }
.nyuchi-studio .ns-chk input { width: auto; accent-color: var(--ns-accent); }

.nyuchi-studio .ns-act {
  width: 100%; background: var(--ns-accent); color: #1a0d06; border: none; border-radius: 999px;
  padding: 11px; font-weight: 700; font-size: 13px; cursor: pointer; margin-top: 7px;
  font-family: var(--font-sans); transition: opacity .15s;
}
.nyuchi-studio .ns-act:hover { opacity: .88; }
.nyuchi-studio .ns-act:disabled { opacity: .55; cursor: default; }
.nyuchi-studio .ns-act.sec { background: transparent; border: 1px solid var(--ns-line); color: var(--ns-fg); }
.nyuchi-studio .ns-hint { font-size: 10px; color: var(--ns-fg2); line-height: 1.5; margin-top: 7px; }
.nyuchi-studio .ns-hide { display: none !important; }

/* Stage */
.nyuchi-studio .ns-stage {
  flex: 1; padding: 24px 20px; display: flex; flex-direction: column; align-items: center; gap: 14px;
  overflow-y: auto; min-height: calc(100dvh - 4rem);
}
.nyuchi-studio .ns-topbar { display: flex; gap: 8px; align-items: center; justify-content: flex-end; width: 100%; max-width: 1100px; }
.nyuchi-studio .ns-topbtn {
  background: var(--ns-panel); border: 1px solid var(--ns-line); color: var(--ns-fg2);
  border-radius: 999px; padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: var(--font-mono);
}
.nyuchi-studio .ns-topbtn:hover { color: var(--ns-fg); }
.nyuchi-studio .ns-preview-frame {
  width: 100%; max-width: 1100px; flex: 1; min-height: 240px;
  display: flex; align-items: center; justify-content: center; padding: 12px;
  background: repeating-conic-gradient(var(--ns-card) 0 25%, transparent 0 50%) 0 0 / 22px 22px;
  border-radius: 10px;
}
.nyuchi-studio .ns-card-host { box-shadow: 0 6px 36px rgba(0,0,0,.45); border-radius: 3px; overflow: hidden; flex-shrink: 0; }
.nyuchi-studio .ns-card-host svg { display: block; width: 100%; height: 100%; }
.nyuchi-studio .ns-meta {
  width: 100%; max-width: 1100px; display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 8px; padding-top: 10px; border-top: 1px solid var(--ns-line);
  font-family: var(--font-mono); font-size: 10px; letter-spacing: .06em; color: var(--ns-fg2); line-height: 1.7;
}
.nyuchi-studio .ns-meta b { color: var(--ns-fg); font-weight: 600; }
.nyuchi-studio .ns-actions { display: flex; gap: 6px; }
.nyuchi-studio .ns-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 99px;
  vertical-align: middle; margin-right: 5px;
}
.nyuchi-studio .ns-btn-act {
  display: inline-flex; align-items: center; height: 34px; padding: 0 16px; border-radius: 999px; border: 0;
  font-family: var(--font-sans); font-size: 12px; font-weight: 600; cursor: pointer; transition: opacity .15s;
}
.nyuchi-studio .ns-btn-act.primary { background: var(--ns-accent); color: #1a0d06; }
.nyuchi-studio .ns-btn-act.ghost { background: transparent; border: 1px solid var(--ns-line); color: var(--ns-fg); }
.nyuchi-studio .ns-btn-act:hover { opacity: .82; }
.nyuchi-studio .ns-btn-act:disabled { opacity: .5; cursor: default; }

@media (max-width: 768px) {
  .nyuchi-studio { flex-direction: column; }
  .nyuchi-studio .ns-panel { width: 100%; position: relative; top: 0; max-height: none; border-right: none; border-bottom: 1px solid var(--ns-line); }
  .nyuchi-studio .ns-stage { min-height: 60vh; padding: 14px 12px 28px; }
  .nyuchi-studio .ns-preview-frame { min-height: 200px; flex: none; }
  .nyuchi-studio .ns-meta { flex-direction: column; align-items: stretch; }
  .nyuchi-studio .ns-actions { justify-content: flex-end; }
}
`;export{w as default};