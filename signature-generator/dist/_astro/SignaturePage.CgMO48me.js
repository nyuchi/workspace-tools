import{n as e,t}from"./react.CD6hyuMb.js";import{o as n,t as r}from"./nyuchi.D_S-VYy1.js";var i=e((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.BLANK_URL=e.relativeFirstCharacters=e.whitespaceEscapeCharsRegex=e.urlSchemeRegex=e.ctrlCharactersRegex=e.htmlCtrlEntityRegex=e.htmlEntitiesRegex=e.invalidProtocolRegex=void 0,e.invalidProtocolRegex=/^([^\w]*)(javascript|data|vbscript)/im,e.htmlEntitiesRegex=/&#(\w+)(^\w|;)?/g,e.htmlCtrlEntityRegex=/&(newline|tab);/gi,e.ctrlCharactersRegex=/[\u0000-\u001F\u007F-\u009F\u2000-\u200D\uFEFF]/gim,e.urlSchemeRegex=/^.+(:|&colon;)/gim,e.whitespaceEscapeCharsRegex=/(\\|%5[cC])((%(6[eE]|72|74))|[nrt])/g,e.relativeFirstCharacters=[`.`,`/`],e.BLANK_URL=`about:blank`})),a=e((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.sanitizeUrl=s;var t=i();function n(e){return t.relativeFirstCharacters.indexOf(e[0])>-1}function r(e){return e.replace(t.ctrlCharactersRegex,``).replace(t.htmlEntitiesRegex,function(e,t){return String.fromCharCode(t)})}function a(e){return URL.canParse(e)}function o(e){try{return decodeURIComponent(e)}catch{return e}}function s(e){if(!e)return t.BLANK_URL;var i,s=o(e.trim());do s=r(s).replace(t.htmlCtrlEntityRegex,``).replace(t.ctrlCharactersRegex,``).replace(t.whitespaceEscapeCharsRegex,``).trim(),s=o(s),i=s.match(t.ctrlCharactersRegex)||s.match(t.htmlEntitiesRegex)||s.match(t.htmlCtrlEntityRegex)||s.match(t.whitespaceEscapeCharsRegex);while(i&&i.length>0);var c=s;if(!c)return t.BLANK_URL;if(n(c))return c;var l=c.trimStart(),u=l.match(t.urlSchemeRegex);if(!u)return c;var d=u[0].toLowerCase().trim();if(t.invalidProtocolRegex.test(d))return t.BLANK_URL;var f=l.replace(/\\/g,`/`);if(d===`mailto:`||d.includes(`://`))return f;if(d===`http:`||d===`https:`){if(!a(f))return t.BLANK_URL;var p=new URL(f);return p.protocol=p.protocol.toLowerCase(),p.hostname=p.hostname.toLowerCase(),p.toString()}return f}})),o=t(),s=a(),c=e=>{if(!e)return``;let t=e.trim();if(t&&!/^[a-z]+:/i.test(t))return(0,s.sanitizeUrl)(`https://${t}`);let n=(0,s.sanitizeUrl)(t);return n===`about:blank`?``:n},l=e=>e?`mailto:${encodeURIComponent(e.trim())}`:``,u=e=>{if(!e)return``;let t=e.replace(/\s/g,``);return`tel:${encodeURIComponent(t)}`},d=e=>{if(!e)return``;let t=e.replace(/[^\d+]/g,``);return`https://wa.me/${encodeURIComponent(t)}`},f=e=>e?e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#039;`):``,p=e=>f(e),m=[`nyuchi`,`mukoko`,`travel`,`learning`,`bundu`,`shamwari`],h={nyuchi:{name:`Nyuchi Africa`,tagline:`I am because we are`,website:`nyuchi.com`,websiteUrl:`https://nyuchi.com`,primaryColor:`#5D4037`,primaryColorDark:`#FFD740`,socials:{linkedin:`https://www.linkedin.com/company/nyuchi/`,facebook:`https://facebook.com/nyuchigroup`,instagram:`https://instagram.com/nyuchi.africa`}},mukoko:{name:`Mukoko`,tagline:`Your Digital Twin Ecosystem`,website:`mukoko.com`,websiteUrl:`https://mukoko.com`,primaryColor:`#4B0082`,primaryColorDark:`#B388FF`,socials:{facebook:`https://facebook.com/mukokoafrica`,instagram:`https://instagram.com/mukoko.africa`}},travel:{name:`Zimbabwe Travel Information`,tagline:`Discover the Heart of Africa`,website:`travel-info.co.zw`,websiteUrl:`https://travel-info.co.zw`,primaryColor:`#004D40`,primaryColorDark:`#64FFDA`,socials:{twitter:`https://x.com/zimbabwetravel`,instagram:`https://instagram.com/zimbabwe.travel`}},learning:{name:`Nyuchi Learning`,tagline:`Education for Africa's Future`,website:`learning.nyuchi.com`,websiteUrl:`https://learning.nyuchi.com`,primaryColor:`#0047AB`,primaryColorDark:`#00B0FF`,socials:{linkedin:`https://www.linkedin.com/company/nyuchi/`,instagram:`https://instagram.com/nyuchi.africa`}},bundu:{name:`Bundu Foundation`,tagline:`The wilderness holds the hive`,website:`bundu.org`,websiteUrl:`https://bundu.org`,primaryColor:`#BF5A36`,primaryColorDark:`#FF8A65`,socials:{}},shamwari:{name:`Shamwari AI`,tagline:`AI that actually works for Africa`,website:`shamwari.ai`,websiteUrl:`https://shamwari.ai`,primaryColor:`#283593`,primaryColorDark:`#3D5AFE`,socials:{}}},g={text:`#141413`,muted:`#52524E`},_=e=>{let t=h[e];if(!t)throw Error(`Unknown brand '${e}'. Expected one of: ${m.join(`, `)}`);return t},v=e=>({name:e.name??``,title:e.title??``,email:e.email??``,phone:e.phone??``,profileImage:e.profileImage??``,linkedin:e.linkedin??``,twitter:e.twitter??``,facebook:e.facebook??``,instagram:e.instagram??``,whatsapp:e.whatsapp??``,promoBanner:e.promoBanner??``,promoLink:e.promoLink??``});function y(e){let t=_(e.brand),n=v(e),r=g,i=(e,t,n)=>{let r=c(e);return r?`<td style="padding-right: 8px;">
        <a href="${p(r)}" style="text-decoration: none;">
          <img src="${p(c(t))}" alt="${p(n)}" width="24" height="24" style="display: block; border-radius: 4px;" />
        </a>
      </td>`:``},a=`<table cellpadding="0" cellspacing="0" style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-size: 14px; line-height: 1.5; color: ${r.text}; max-width: 500px;">
      <tbody>
        <tr>`;return n.profileImage&&(a+=`<td style="vertical-align: top; padding-right: 16px;">
        <img src="${p(c(n.profileImage))}" alt="Profile" width="80" height="80" style="border-radius: 50%; display: block; object-fit: cover;" />
      </td>`),a+=`<td style="vertical-align: top;">
      <span style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; font-size: 17px; font-weight: 700; color: ${r.text};">${f(n.name)}</span>
      <br />
      <span style="font-size: 13px; font-weight: 500; color: ${r.muted};">${f(n.title)}</span>
      <br /><br />
      <span style="font-family: 'Noto Serif', Georgia, serif; font-size: 15px; font-weight: 700; color: ${t.primaryColor};">${f(t.name)}</span>
      <br />
      <span style="font-size: 12px; font-style: italic; color: ${r.muted};">"${f(t.tagline)}"</span>
      <br /><br />
      <table cellpadding="0" cellspacing="0" style="font-size: 13px; color: ${r.muted};">
        <tbody>
          <tr>
            <td style="padding-bottom: 3px;">
              <a href="${p(l(n.email))}" style="color: ${t.primaryColor}; text-decoration: none;">${f(n.email)}</a>
            </td>
          </tr>`,n.phone&&(a+=`<tr>
        <td style="padding-bottom: 3px;">
          <a href="${p(u(n.phone))}" style="color: ${t.primaryColor}; text-decoration: none;">${f(n.phone)}</a>
        </td>
      </tr>`),a+=`<tr>
        <td>
          <a href="${p(t.websiteUrl)}" style="color: ${t.primaryColor}; text-decoration: none;">${f(t.website)}</a>
        </td>
      </tr>
        </tbody>
      </table>
      <br />
      <table cellpadding="0" cellspacing="0">
        <tbody>
          <tr>
            ${i(n.linkedin,`https://cdn-icons-png.flaticon.com/512/3536/3536505.png`,`LinkedIn`)}
            ${i(n.twitter,`https://cdn-icons-png.flaticon.com/512/5969/5969020.png`,`X`)}
            ${i(n.facebook,`https://cdn-icons-png.flaticon.com/512/5968/5968764.png`,`Facebook`)}
            ${i(n.instagram,`https://cdn-icons-png.flaticon.com/512/2111/2111463.png`,`Instagram`)}
            ${n.whatsapp?i(d(n.whatsapp),`https://cdn-icons-png.flaticon.com/512/3670/3670051.png`,`WhatsApp`):``}
          </tr>
        </tbody>
      </table>
    </td>
  </tr>`,n.promoBanner&&(a+=`<tr>
        <td colspan="2" style="padding-top: 16px;"></td>
      </tr>
      <tr>
        <td colspan="2">
          <a href="${p(c(n.promoLink)||`#`)}" style="text-decoration: none;">
            <img src="${p(c(n.promoBanner))}" alt="Promotion" width="400" style="display: block; max-width: 100%; height: auto; border-radius: 8px;" />
          </a>
        </td>
      </tr>`),a+=`</tbody></table>`,a}function b(e){let t=_(e.brand),n=v(e),r=`${n.name}\n${n.title}\n\n${t.name}\n"${t.tagline}"\n\n${n.email}`;return n.phone&&(r+=`\n${n.phone}`),r+=`\n${t.website}`,r}var x={nyuchi:`gold`,mukoko:`tanzanite`,travel:`malachite`,learning:`cobalt`,bundu:`copper`,shamwari:`sodalite`},S={nyuchi:`Nyuchi`,mukoko:`Mukoko`,travel:`Travel`,learning:`Learning`,bundu:`Bundu`,shamwari:`Shamwari`},C=e=>{let t=h[e].socials;return{linkedin:t.linkedin||``,twitter:t.twitter||``,facebook:t.facebook||``,instagram:t.instagram||``}},w=(e,t,n)=>({brand:e,...t,profileImage:n.profile?``:t.profileImage,promoBanner:n.banner?``:t.promoBanner}),T=e=>{let t=[e.linkedin,e.twitter,e.facebook,e.instagram].filter(e=>!!(e&&c(e))).length;e.whatsapp&&(t+=1);let n=[];return e.profileImage&&n.push(`photo`),t&&n.push(`socials ×${t}`),e.promoBanner&&n.push(`banner`),n.length?n.join(` · `):`text only`},E=class extends Error{status;error;detail;constructor(e,t,n){super(n?`${t}: ${n}`:t),this.name=`ApiError`,this.status=e,this.error=t,this.detail=n}},D=e=>e instanceof E&&e.status===401,O=e=>e instanceof E||e instanceof Error?e.message:String(e),k={"Content-Type":`application/json`};async function A(e,t){let n=await fetch(e,{credentials:`same-origin`,...t}),r=null;try{r=await n.json()}catch{}if(!n.ok){let e=r??{};throw new E(n.status,e.error||`HTTP ${n.status}`,e.detail)}return r}var j=()=>A(`/api/google/status`),M=e=>`/api/google/login?mode=${e}`,N=e=>A(`/api/self/insert`,{method:`POST`,headers:k,body:JSON.stringify(e)}),P=()=>A(`/api/admin/users`),F=e=>A(`/api/admin/push`,{method:`POST`,headers:k,body:JSON.stringify(e)}),I=e=>A(`/api/signature`,{method:`POST`,headers:k,body:JSON.stringify(e)}),L=e=>m.includes(e),R=e=>{let t=L(e.brand)?e.brand:`nyuchi`;return{brand:t,name:e.name,email:e.email,title:e.title??``,phone:e.phone??``,whatsapp:``,profileImage:``,promoBanner:``,promoLink:``,...C(t)}},z=e=>{let t={pushed:0,dryRun:0,failed:0};for(let n of e)n.status===`pushed`?t.pushed+=1:n.status===`dry-run`?t.dryRun+=1:t.failed+=1;return t},B=e=>{let t=[];return e.pushed&&t.push(`${e.pushed} pushed`),e.dryRun&&t.push(`${e.dryRun} dry-run`),e.failed&&t.push(`${e.failed} failed`),t.length?t.join(` · `):`no results`},V=n(),H=()=>{let[e,t]=(0,o.useState)(`checking`),[n,r]=(0,o.useState)(null),[i,a]=(0,o.useState)(null),[s,c]=(0,o.useState)([]),[l,u]=(0,o.useState)(``),[d,f]=(0,o.useState)(``),[p,m]=(0,o.useState)(new Set),[h,g]=(0,o.useState)(!0),[_,v]=(0,o.useState)(!1),[y,b]=(0,o.useState)(null),[C,w]=(0,o.useState)({}),[T,E]=(0,o.useState)(null),[k,A]=(0,o.useState)(null),[N,H]=(0,o.useState)(null),[G,K]=(0,o.useState)({});(0,o.useEffect)(()=>{let e=!1;return(async()=>{try{let n=await j();if(e)return;if(!n.connected){t(`connect`);return}a(n.email??null),t(`loading-users`);let r=await P();if(e)return;c(r.users),u(r.domain),t(`ready`)}catch(n){if(e)return;if(D(n)){t(`connect`);return}r(O(n)),t(`error`)}})(),()=>{e=!0}},[]);let q=(0,o.useMemo)(()=>{let e=d.trim().toLowerCase();return e?s.filter(t=>t.name.toLowerCase().includes(e)||t.email.toLowerCase().includes(e)):s},[s,d]),J=q.length>0&&q.every(e=>p.has(e.email)),Y=(0,o.useCallback)(e=>{m(t=>{let n=new Set(t);return n.has(e)?n.delete(e):n.add(e),n}),v(!1)},[]),X=(0,o.useCallback)(()=>{m(e=>{let t=new Set(e),n=q.length>0&&q.every(e=>t.has(e.email));for(let e of q)n?t.delete(e.email):t.add(e.email);return t}),v(!1)},[q]),Z=(0,o.useCallback)(async e=>{let n=[...p];if(!(!n.length||y)){A(null),v(!1),b(e?`dry`:`push`);try{let t=await F({targets:n,dryRun:e,includeAliases:h}),r={};for(let e of t.results)r[e.email]=e;w(r),E(t.summary??z(t.results))}catch(e){D(e)?t(`connect`):A(O(e))}finally{b(null)}}},[p,h,y]),Q=(0,o.useCallback)(async e=>{if(N===e.email){H(null);return}if(H(e.email),!G[e.email]?.html)try{let{html:t}=await I(R(e));K(n=>({...n,[e.email]:{html:t}}))}catch(t){K(n=>({...n,[e.email]:{error:O(t)}}))}},[N,G]);if(e===`checking`||e===`loading-users`)return(0,V.jsxs)(`div`,{className:`sga-wrap`,children:[(0,V.jsx)(`style`,{children:W}),(0,V.jsxs)(`div`,{className:`sga-gate`,children:[(0,V.jsx)(`h2`,{children:`Admin console`}),(0,V.jsx)(`p`,{className:`sga-muted`,children:e===`checking`?`Checking Google connection…`:`Loading domain users…`})]})]});if(e===`connect`)return(0,V.jsxs)(`div`,{className:`sga-wrap`,children:[(0,V.jsx)(`style`,{children:W}),(0,V.jsxs)(`div`,{className:`sga-gate`,children:[(0,V.jsx)(`h2`,{children:`Admin console`}),(0,V.jsx)(`p`,{className:`sga-muted`,children:`Connect a Google Workspace admin account to list domain users and push signatures. You will be redirected to Google to authorize directory access.`}),(0,V.jsx)(`button`,{type:`button`,className:`sga-btn primary`,onClick:()=>window.location.assign(M(`admin`)),children:`Connect Google`})]})]});if(e===`error`)return(0,V.jsxs)(`div`,{className:`sga-wrap`,children:[(0,V.jsx)(`style`,{children:W}),(0,V.jsxs)(`div`,{className:`sga-gate`,children:[(0,V.jsx)(`h2`,{children:`Admin console`}),(0,V.jsx)(`div`,{className:`sga-alert`,role:`alert`,children:n})]})]});let $=p.size;return(0,V.jsxs)(`div`,{className:`sga-wrap`,children:[(0,V.jsx)(`style`,{children:W}),(0,V.jsxs)(`div`,{className:`sga-toolbar`,children:[(0,V.jsx)(`input`,{type:`search`,className:`sga-search`,placeholder:`Search by name or email…`,value:d,onChange:e=>f(e.target.value),"aria-label":`Search users by name or email`}),(0,V.jsxs)(`span`,{className:`sga-muted sga-toolbar-meta`,children:[l,i?` · connected as ${i}`:``]})]}),(0,V.jsx)(`div`,{className:`sga-table-wrap`,children:(0,V.jsxs)(`table`,{className:`sga-table`,children:[(0,V.jsx)(`thead`,{children:(0,V.jsxs)(`tr`,{children:[(0,V.jsx)(`th`,{className:`sga-col-check`,children:(0,V.jsx)(`input`,{type:`checkbox`,checked:J,onChange:X,"aria-label":`Select all listed users`})}),(0,V.jsx)(`th`,{children:`Name`}),(0,V.jsx)(`th`,{children:`Email`}),(0,V.jsx)(`th`,{children:`Brand`}),(0,V.jsx)(`th`,{children:`Title`}),(0,V.jsx)(`th`,{children:`Aliases`}),(0,V.jsx)(`th`,{children:`Status`}),(0,V.jsx)(`th`,{className:`sga-col-preview`})]})}),(0,V.jsxs)(`tbody`,{children:[q.length===0&&(0,V.jsx)(`tr`,{children:(0,V.jsx)(`td`,{colSpan:8,className:`sga-empty`,children:s.length===0?`No users in the directory.`:`No users match the search.`})}),q.map(e=>{let t=L(e.brand)?e.brand:`nyuchi`,n=x[t],r=C[e.email],i=N===e.email,a=G[e.email];return(0,V.jsxs)(o.Fragment,{children:[(0,V.jsxs)(`tr`,{className:p.has(e.email)?`sga-row selected`:`sga-row`,children:[(0,V.jsx)(`td`,{className:`sga-col-check`,children:(0,V.jsx)(`input`,{type:`checkbox`,checked:p.has(e.email),onChange:()=>Y(e.email),"aria-label":`Select ${e.email}`})}),(0,V.jsx)(`td`,{className:`sga-name`,children:e.name}),(0,V.jsx)(`td`,{className:`sga-email`,children:e.email}),(0,V.jsx)(`td`,{children:(0,V.jsxs)(`span`,{className:`sga-chip`,children:[(0,V.jsx)(`span`,{className:`sga-chip-dot`,style:{background:`var(--color-${n})`}}),S[t]]})}),(0,V.jsx)(`td`,{className:`sga-title`,children:e.title||`—`}),(0,V.jsx)(`td`,{className:`sga-aliases`,children:e.aliases.length}),(0,V.jsxs)(`td`,{children:[r?(0,V.jsxs)(`span`,{className:`sga-status ${r.status}`,title:r.error||r.sendAs,children:[r.status===`pushed`&&`✓ pushed`,r.status===`dry-run`&&`◌ dry-run`,r.status===`failed`&&`✕ failed`]}):(0,V.jsx)(`span`,{className:`sga-muted`,children:`—`}),r?.status===`failed`&&r.error&&(0,V.jsx)(`div`,{className:`sga-row-error`,children:r.error})]}),(0,V.jsx)(`td`,{className:`sga-col-preview`,children:(0,V.jsx)(`button`,{type:`button`,className:`sga-btn row`,"aria-expanded":i,onClick:()=>Q(e),children:i?`Close`:`Preview`})})]}),i&&(0,V.jsx)(`tr`,{className:`sga-drawer`,children:(0,V.jsxs)(`td`,{colSpan:8,children:[!a&&(0,V.jsx)(`div`,{className:`sga-muted sga-drawer-note`,children:`Rendering preview…`}),a?.error&&(0,V.jsx)(`div`,{className:`sga-alert`,role:`alert`,children:a.error}),a?.html&&(0,V.jsx)(`iframe`,{className:`sga-preview-frame`,sandbox:``,title:`Signature preview for ${e.email}`,srcDoc:U(a.html)})]})})]},e.email)})]})]})}),k&&(0,V.jsx)(`div`,{className:`sga-alert`,role:`alert`,children:k}),(0,V.jsxs)(`div`,{className:`sga-actions`,children:[(0,V.jsxs)(`span`,{className:`sga-count`,children:[q.length,` of `,s.length,` users · `,$,` selected`,T?` · ${B(T)}`:``]}),(0,V.jsxs)(`label`,{className:`sga-toggle`,children:[(0,V.jsx)(`input`,{type:`checkbox`,checked:h,onChange:e=>g(e.target.checked)}),`Include aliases`]}),(0,V.jsx)(`button`,{type:`button`,className:`sga-btn ghost`,disabled:!$||!!y,onClick:()=>Z(!0),children:y===`dry`?`Running dry run…`:`Dry run`}),_?(0,V.jsxs)(V.Fragment,{children:[(0,V.jsxs)(`span`,{className:`sga-confirm`,children:[`Push signatures to `,$,` user`,$===1?``:`s`,h?` (incl. aliases)`:``,`?`]}),(0,V.jsx)(`button`,{type:`button`,className:`sga-btn ghost`,onClick:()=>v(!1),children:`Cancel`}),(0,V.jsx)(`button`,{type:`button`,className:`sga-btn primary`,onClick:()=>Z(!1),children:`Confirm push`})]}):(0,V.jsx)(`button`,{type:`button`,className:`sga-btn primary`,disabled:!$||!!y,onClick:()=>v(!0),children:y===`push`?`Pushing…`:`Push signatures`})]})]})},U=e=>`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:20px 24px;background:#FFFFFF;color:#141413;">${e}</body></html>`,W=`
.signature-studio .sga-wrap {
  width: 100%; max-width: 1100px; display: flex; flex-direction: column; gap: 14px; flex: 1;
}
.signature-studio .sga-muted { color: var(--sg-fg2); }

/* Gate card */
.signature-studio .sga-gate {
  margin: 40px auto 0; max-width: 460px; width: 100%; text-align: center;
  background: var(--sg-panel); border: 1px solid var(--sg-line); border-radius: 14px;
  padding: 36px 28px; display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.signature-studio .sga-gate h2 { font-family: var(--font-serif); font-size: 19px; font-weight: 700; margin: 0; }
.signature-studio .sga-gate p { margin: 0; font-size: 13px; line-height: 1.6; }

/* Buttons — pills; standalone actions keep a 48px touch target. */
.signature-studio .sga-btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 48px; padding: 0 22px; border-radius: 999px; border: 0;
  font-family: var(--font-sans); font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity .15s;
}
.signature-studio .sga-btn.primary { background: var(--sg-accent); color: var(--sg-accent-fg, var(--primary-foreground)); }
.signature-studio .sga-btn.ghost { background: transparent; border: 1px solid var(--sg-line); color: var(--sg-fg); }
.signature-studio .sga-btn.row { min-height: 36px; padding: 0 14px; font-size: 12px; background: transparent; border: 1px solid var(--sg-line); color: var(--sg-fg); }
.signature-studio .sga-btn:hover:not(:disabled) { opacity: .82; }
.signature-studio .sga-btn:disabled { opacity: .45; cursor: not-allowed; }

/* Toolbar */
.signature-studio .sga-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.signature-studio .sga-search {
  flex: 1; min-width: 220px; min-height: 48px;
  background: var(--sg-input); border: 1px solid var(--sg-line); color: var(--sg-fg);
  border-radius: 999px; padding: 0 18px; font-family: var(--font-sans); font-size: 13px;
  outline: none; transition: border-color .15s;
}
.signature-studio .sga-search:focus { border-color: var(--sg-accent); }
.signature-studio .sga-toolbar-meta { font-family: var(--font-mono); font-size: 10px; letter-spacing: .06em; }

/* Table */
.signature-studio .sga-table-wrap {
  width: 100%; overflow-x: auto; background: var(--sg-panel);
  border: 1px solid var(--sg-line); border-radius: 14px;
}
.signature-studio .sga-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.signature-studio .sga-table th {
  font-family: var(--font-mono); font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .12em; color: var(--sg-fg2); text-align: left;
  padding: 12px; border-bottom: 1px solid var(--sg-line); white-space: nowrap;
}
.signature-studio .sga-table td { padding: 8px 12px; border-bottom: 1px solid var(--sg-line); vertical-align: middle; }
.signature-studio .sga-row { height: 48px; }
.signature-studio .sga-row.selected { background: var(--sg-card-check); }
.signature-studio .sga-table tbody tr:last-child td { border-bottom: none; }
.signature-studio .sga-table input[type='checkbox'] { width: 18px; height: 18px; accent-color: var(--sg-accent); cursor: pointer; }
.signature-studio .sga-col-check { width: 34px; }
.signature-studio .sga-col-preview { text-align: right; white-space: nowrap; }
.signature-studio .sga-name { font-weight: 600; white-space: nowrap; }
.signature-studio .sga-email { font-family: var(--font-mono); font-size: 11px; color: var(--sg-fg2); white-space: nowrap; }
.signature-studio .sga-title { color: var(--sg-fg2); }
.signature-studio .sga-aliases { font-family: var(--font-mono); font-size: 11px; color: var(--sg-fg2); }
.signature-studio .sga-empty { text-align: center; color: var(--sg-fg2); padding: 28px 12px; }

.signature-studio .sga-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px;
  border: 1px solid var(--sg-line); border-radius: 999px; font-size: 11px; white-space: nowrap;
}
.signature-studio .sga-chip-dot { width: 8px; height: 8px; border-radius: 99px; }

.signature-studio .sga-status { font-family: var(--font-mono); font-size: 11px; white-space: nowrap; }
.signature-studio .sga-status.pushed { color: var(--success); }
.signature-studio .sga-status.dry-run { color: var(--sg-fg2); }
.signature-studio .sga-status.failed { color: var(--error); }
.signature-studio .sga-row-error { font-size: 11px; color: var(--error); line-height: 1.4; margin-top: 2px; max-width: 260px; }

/* Preview drawer */
.signature-studio .sga-drawer td { background: var(--sg-card-check); padding: 12px; }
.signature-studio .sga-drawer-note { font-size: 12px; padding: 6px 2px; }
.signature-studio .sga-preview-frame {
  width: 100%; max-width: 680px; height: 240px; display: block;
  border: 0; border-radius: 10px; background: #FFFFFF; box-shadow: 0 6px 36px rgba(0,0,0,.35);
}

/* Actions bar */
.signature-studio .sga-actions {
  display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-wrap: wrap;
  padding-top: 10px; border-top: 1px solid var(--sg-line);
}
.signature-studio .sga-count {
  margin-right: auto; font-family: var(--font-mono); font-size: 10px; letter-spacing: .06em;
  color: var(--sg-fg2); line-height: 1.7;
}
.signature-studio .sga-toggle {
  display: inline-flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 6px;
  font-size: 12px; color: var(--sg-fg); cursor: pointer; user-select: none;
}
.signature-studio .sga-toggle input { width: 18px; height: 18px; accent-color: var(--sg-accent); cursor: pointer; }
.signature-studio .sga-confirm { font-size: 12px; font-weight: 600; color: var(--sg-fg); }

/* Muted alert — backend {error, detail} text lands here verbatim. */
.signature-studio .sga-alert {
  width: 100%; padding: 10px 14px; border-radius: 10px;
  background: var(--sg-input); border: 1px solid var(--sg-line); color: var(--sg-fg2);
  font-size: 12px; line-height: 1.5; overflow-wrap: anywhere;
}

@media (max-width: 768px) {
  .signature-studio .sga-toolbar-meta { display: none; }
  .signature-studio .sga-actions { justify-content: stretch; }
  .signature-studio .sga-actions .sga-btn { flex: 1; }
}
`,G=({brand:e,form:t,imageErrors:n,onBrandChange:i,onField:a})=>{let o=e=>({value:t[e],onChange:t=>a(e,t.target.value)});return(0,V.jsxs)(`aside`,{className:`sg-panel`,children:[(0,V.jsx)(`h1`,{children:`Email Signature`}),(0,V.jsx)(`span`,{className:`sg-tag`,children:`signature builder · bundu ecosystem · gmail-ready`}),(0,V.jsxs)(`div`,{className:`sg-grp`,children:[(0,V.jsx)(`h2`,{children:`01 · Brand`}),(0,V.jsx)(`div`,{className:`sg-brands`,children:m.map(t=>{let n=r[x[t]];return(0,V.jsxs)(`button`,{type:`button`,className:`sg-brand-chip`+(t===e?` active`:``),title:`${h[t].name} · ${h[t].website}`,onClick:()=>i(t),children:[(0,V.jsx)(`span`,{className:`sg-chip-color`,style:{background:`linear-gradient(135deg, ${n.dark} 0 50%, ${n.light} 50% 100%)`}}),(0,V.jsx)(`span`,{className:`sg-chip-name`,children:S[t]})]},t)})}),(0,V.jsx)(`div`,{className:`sg-hint`,children:`Switching brand reloads that brand's default social links below.`})]}),(0,V.jsxs)(`div`,{className:`sg-grp`,children:[(0,V.jsx)(`h2`,{children:`02 · Identity`}),(0,V.jsxs)(`label`,{children:[`Full name `,(0,V.jsx)(`span`,{className:`sg-req`,children:`*`})]}),(0,V.jsx)(`input`,{type:`text`,placeholder:`Bryan Fawcett`,...o(`name`)}),(0,V.jsxs)(`label`,{children:[`Job title `,(0,V.jsx)(`span`,{className:`sg-req`,children:`*`})]}),(0,V.jsx)(`input`,{type:`text`,placeholder:`CEO & Founder`,...o(`title`)}),(0,V.jsxs)(`label`,{children:[`Email `,(0,V.jsx)(`span`,{className:`sg-req`,children:`*`})]}),(0,V.jsx)(`input`,{type:`email`,placeholder:`bryan@nyuchi.com`,...o(`email`)}),(0,V.jsxs)(`div`,{className:`sg-two`,children:[(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`label`,{children:`Phone`}),(0,V.jsx)(`input`,{type:`tel`,placeholder:`+65 9814 3374`,...o(`phone`)})]}),(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`label`,{children:`WhatsApp`}),(0,V.jsx)(`input`,{type:`text`,placeholder:`263771234567`,...o(`whatsapp`)})]})]})]}),(0,V.jsxs)(`div`,{className:`sg-grp`,children:[(0,V.jsx)(`h2`,{children:`03 · Images`}),(0,V.jsx)(`label`,{children:`Profile image URL`}),(0,V.jsx)(`input`,{type:`url`,className:n.profile?`sg-input-error`:void 0,placeholder:`https://...`,...o(`profileImage`)}),n.profile&&(0,V.jsx)(`div`,{className:`sg-warn`,children:`Failed to load image. Please check the URL — it is left out of the signature.`}),(0,V.jsxs)(`div`,{className:`sg-two`,children:[(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`label`,{children:`Promo banner URL`}),(0,V.jsx)(`input`,{type:`url`,className:n.banner?`sg-input-error`:void 0,placeholder:`https://...`,...o(`promoBanner`)})]}),(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`label`,{children:`Banner link URL`}),(0,V.jsx)(`input`,{type:`url`,placeholder:`https://...`,...o(`promoLink`)})]})]}),n.banner&&(0,V.jsx)(`div`,{className:`sg-warn`,children:`Failed to load banner — it is left out of the signature.`})]}),(0,V.jsxs)(`div`,{className:`sg-grp`,children:[(0,V.jsx)(`h2`,{children:`04 · Social links`}),(0,V.jsx)(`label`,{children:`LinkedIn`}),(0,V.jsx)(`input`,{type:`url`,placeholder:`https://linkedin.com/in/...`,...o(`linkedin`)}),(0,V.jsx)(`label`,{children:`X / Twitter`}),(0,V.jsx)(`input`,{type:`url`,placeholder:`https://x.com/...`,...o(`twitter`)}),(0,V.jsx)(`label`,{children:`Facebook`}),(0,V.jsx)(`input`,{type:`url`,placeholder:`https://facebook.com/...`,...o(`facebook`)}),(0,V.jsx)(`label`,{children:`Instagram`}),(0,V.jsx)(`input`,{type:`url`,placeholder:`https://instagram.com/...`,...o(`instagram`)})]}),(0,V.jsxs)(`div`,{className:`sg-grp`,children:[(0,V.jsx)(`h2`,{children:`05 · Help`}),(0,V.jsx)(`div`,{className:`sg-hint`,children:`The preview updates as you type. “Copy for Gmail” puts the rich signature on your clipboard — paste it into Gmail Settings → General → Signature and save.`}),(0,V.jsx)(`div`,{className:`sg-hint`,children:(0,V.jsx)(`a`,{href:`/help#signature`,children:`Full setup guide →`})})]})]})},K=(0,o.forwardRef)(({html:e,profileImage:t,promoBanner:n,onImageError:r},i)=>(0,V.jsxs)(`div`,{className:`sg-preview-frame`,children:[(0,V.jsx)(`div`,{ref:i,className:`sg-card`,dangerouslySetInnerHTML:{__html:e}}),(0,V.jsx)(`p`,{className:`sg-card-note`,children:`rendered on white — signatures keep the recipient's inbox background, not the app theme`}),t&&(0,V.jsx)(`img`,{className:`sg-probe`,src:c(t),alt:``,"aria-hidden":`true`,onError:()=>r(`profile`)}),n&&(0,V.jsx)(`img`,{className:`sg-probe`,src:c(n),alt:``,"aria-hidden":`true`,onError:()=>r(`banner`)})]}));K.displayName=`SignaturePreview`;var q={name:``,title:``,email:``,phone:``,whatsapp:``,profileImage:``,promoBanner:``,promoLink:``,...C(`nyuchi`)};function J(){return typeof document>`u`?`light`:document.documentElement.getAttribute(`data-theme`)===`dark`?`dark`:`light`}var Y=()=>{let[e,t]=(0,o.useState)(`self`),[n,r]=(0,o.useState)(`nyuchi`),[i,a]=(0,o.useState)(q),[s,c]=(0,o.useState)({}),[l,u]=(0,o.useState)(null),[d,f]=(0,o.useState)(null),[p,m]=(0,o.useState)(`idle`),[g,_]=(0,o.useState)(null),[v,S]=(0,o.useState)(null),E=(0,o.useRef)(null);(0,o.useEffect)(()=>{let e=localStorage.getItem(`nyuchi-theme`);(e===`dark`||e===`light`)&&document.documentElement.setAttribute(`data-theme`,e)},[]);let k=(0,o.useCallback)(()=>{let e=J()===`dark`?`light`:`dark`;document.documentElement.setAttribute(`data-theme`,e),localStorage.setItem(`nyuchi-theme`,e)},[]),A=(0,o.useCallback)(e=>{r(e),a(t=>({...t,...C(e)}))},[]),P=(0,o.useCallback)(e=>{c(t=>t[e]?t:{...t,[e]:!0})},[]),F=(0,o.useCallback)((e,t)=>{a(n=>({...n,[e]:t})),e===`profileImage`&&c(e=>e.profile?{...e,profile:!1}:e),e===`promoBanner`&&c(e=>e.banner?{...e,banner:!1}:e)},[]),I=(0,o.useMemo)(()=>w(n,i,s),[n,i,s]),L=(0,o.useMemo)(()=>y(I),[I]),R=(0,o.useMemo)(()=>b(I),[I]),z=(0,o.useCallback)(async()=>{if(!(p===`checking`||p===`inserting`)){if(S(null),p===`connect`){window.location.assign(M(`self`));return}try{if(m(`checking`),!(await j()).connected){m(`connect`);return}m(`inserting`);let e=await N(I);_(e.sendAs),m(`done`),window.setTimeout(()=>m(`idle`),5e3)}catch(e){if(D(e)){m(`connect`);return}m(`idle`),S(O(e))}}},[p,I]),B=p===`checking`?`Checking…`:p===`connect`?`Connect Google`:p===`inserting`?`Inserting…`:p===`done`?`✓ Inserted`:`Insert into Gmail`,U=(0,o.useCallback)(e=>{u(e),window.setTimeout(()=>u(null),2e3)},[]),W=(0,o.useCallback)(e=>{console.error(`Failed to copy:`,e),f(`Failed to copy. Try selecting the signature manually and pressing Ctrl+C.`),window.setTimeout(()=>f(null),5e3)},[]),Y=(0,o.useCallback)(async()=>{if(E.current){f(null);try{if(navigator.clipboard&&typeof ClipboardItem<`u`){let e=new Blob([L],{type:`text/html`}),t=new Blob([R],{type:`text/plain`});await navigator.clipboard.write([new ClipboardItem({"text/html":e,"text/plain":t})])}else{let e=window.getSelection(),t=document.createRange();t.selectNodeContents(E.current),e?.removeAllRanges(),e?.addRange(t);let n=document.execCommand(`copy`);if(e?.removeAllRanges(),!n)throw Error(`Copy command failed`)}U(`gmail`)}catch(e){W(e)}}},[L,R,U,W]),Z=(0,o.useCallback)(async(e,t)=>{f(null);try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(e);else{let t=document.createElement(`textarea`);t.value=e,t.setAttribute(`readonly`,``),t.style.position=`fixed`,t.style.opacity=`0`,document.body.appendChild(t),t.select();let n=document.execCommand(`copy`);if(t.remove(),!n)throw Error(`Copy command failed`)}U(t)}catch(e){W(e)}},[U,W]);(0,o.useEffect)(()=>{if(typeof document>`u`||!(`modelContext`in document))return;let e=new AbortController;return document.modelContext?.registerTool({name:`copy_signature_html`,description:`Copy the current Nyuchi email signature as rich HTML to the clipboard.`,inputSchema:{type:`object`,properties:{}},execute:async()=>(await Z(L,`html`),{status:`copied`,format:`html`}),annotations:{readOnlyHint:!1}},{signal:e.signal}),document.modelContext?.registerTool({name:`copy_signature_text`,description:`Copy the current Nyuchi email signature as plain text to the clipboard.`,inputSchema:{type:`object`,properties:{}},execute:async()=>(await Z(R,`text`),{status:`copied`,format:`text`}),annotations:{readOnlyHint:!1}},{signal:e.signal}),()=>e.abort()},[Z,L,R]);let Q=h[n],$=x[n],ee=T(I),te={"--sg-accent":`var(--color-${$})`};return(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(`style`,{children:X}),(0,V.jsxs)(`div`,{className:`signature-studio`,"data-brand":n,style:te,children:[e===`self`&&(0,V.jsx)(G,{brand:n,form:i,imageErrors:s,onBrandChange:A,onField:F}),(0,V.jsxs)(`div`,{className:`sg-stage`,children:[(0,V.jsxs)(`div`,{className:`sg-topbar`,children:[(0,V.jsxs)(`div`,{className:`sg-modes`,role:`group`,"aria-label":`Console mode`,children:[(0,V.jsx)(`button`,{type:`button`,className:`sg-mode`+(e===`self`?` active`:``),"aria-pressed":e===`self`,onClick:()=>t(`self`),children:`Self`}),(0,V.jsx)(`button`,{type:`button`,className:`sg-mode`+(e===`admin`?` active`:``),"aria-pressed":e===`admin`,onClick:()=>t(`admin`),children:`Admin`})]}),(0,V.jsx)(`button`,{type:`button`,className:`sg-topbtn`,onClick:k,children:`◐ Theme`})]}),e===`admin`?(0,V.jsx)(H,{}):(0,V.jsxs)(V.Fragment,{children:[(0,V.jsx)(K,{ref:E,html:L,profileImage:i.profileImage,promoBanner:i.promoBanner,onImageError:P}),d&&(0,V.jsx)(`div`,{className:`sg-error`,role:`alert`,children:d}),v&&(0,V.jsx)(`div`,{className:`sg-alert`,role:`alert`,children:v}),p===`done`&&g&&(0,V.jsxs)(`div`,{className:`sg-alert`,role:`status`,children:[`Signature inserted into Gmail for `,g,`.`]}),(0,V.jsxs)(`div`,{className:`sg-meta`,children:[(0,V.jsxs)(`div`,{children:[(0,V.jsx)(`b`,{children:Q.name}),` · `,(0,V.jsxs)(`span`,{children:[`“`,Q.tagline,`”`]}),(0,V.jsx)(`br`,{}),(0,V.jsxs)(`span`,{children:[(0,V.jsx)(`span`,{className:`sg-dot`,style:{background:`var(--color-${$})`}}),$]}),` `,`· `,(0,V.jsx)(`span`,{children:ee})]}),(0,V.jsxs)(`div`,{className:`sg-actions`,children:[(0,V.jsx)(`button`,{type:`button`,className:`sg-btn-act ghost`,onClick:()=>Z(R,`text`),children:l===`text`?`✓ Copied`:`Copy plain text`}),(0,V.jsx)(`button`,{type:`button`,className:`sg-btn-act ghost`,onClick:()=>Z(L,`html`),children:l===`html`?`✓ Copied`:`Copy HTML`}),(0,V.jsx)(`button`,{type:`button`,className:`sg-btn-act primary`,onClick:Y,children:l===`gmail`?`✓ Copied!`:`Copy for Gmail`}),(0,V.jsx)(`button`,{type:`button`,className:`sg-btn-act primary`,disabled:p===`checking`||p===`inserting`,onClick:z,children:B})]})]})]})]})]})]})},X=`
.signature-studio {
  --sg-fg: var(--foreground);
  --sg-fg2: var(--muted-foreground);
  --sg-bg: var(--background);
  --sg-panel: var(--surface);
  --sg-card-check: var(--overlay);
  --sg-line: var(--border);
  --sg-accent: var(--color-gold);
  --sg-input: var(--input);
  display: flex;
  min-height: calc(100dvh - 4rem);
  background: var(--sg-bg);
  color: var(--sg-fg);
  font-family: var(--font-sans);
}
.signature-studio *,
.signature-studio *::before,
.signature-studio *::after { box-sizing: border-box; }

/* Panel */
.signature-studio .sg-panel {
  width: 330px; flex-shrink: 0;
  background: var(--sg-panel);
  border-right: 1px solid var(--sg-line);
  padding: 18px 16px;
  overflow-y: auto;
  max-height: calc(100dvh - 4rem);
  position: sticky; top: 4rem;
}
.signature-studio .sg-panel h1 { font-family: var(--font-serif); font-size: 19px; font-weight: 700; margin: 0 0 2px; }
.signature-studio .sg-tag {
  font-family: var(--font-mono); font-size: 10px; color: var(--sg-fg2);
  margin-bottom: 16px; display: block; letter-spacing: .08em;
}
.signature-studio .sg-grp { margin-bottom: 15px; border-bottom: 1px solid var(--sg-line); padding-bottom: 14px; }
.signature-studio .sg-grp:last-child { border: none; margin-bottom: 0; }
.signature-studio .sg-grp h2 {
  font-size: 10px; text-transform: uppercase; letter-spacing: .14em;
  color: var(--sg-fg2); margin-bottom: 9px; font-family: var(--font-mono); font-weight: 600;
}
.signature-studio .sg-panel label { display: block; font-size: 11px; color: var(--sg-fg2); margin: 9px 0 3px; }
.signature-studio .sg-panel input {
  width: 100%; background: var(--sg-input); border: 1px solid var(--sg-line); color: var(--sg-fg);
  border-radius: 999px; padding: 8px 14px; font-family: var(--font-sans); font-size: 13px;
  outline: none; transition: border-color .15s;
}
.signature-studio .sg-panel input:focus { border-color: var(--sg-accent); }
.signature-studio .sg-panel input.sg-input-error { border-color: var(--error); }
.signature-studio .sg-two { display: flex; gap: 8px; }
.signature-studio .sg-two > div { flex: 1; min-width: 0; }
.signature-studio .sg-req { display: inline; margin: 0; color: var(--error); }
.signature-studio .sg-warn { font-size: 11px; color: var(--error); line-height: 1.4; margin-top: 5px; }

.signature-studio .sg-brands { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 5px; }
.signature-studio .sg-brand-chip {
  display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 2px;
  background: var(--sg-input); border: 1.5px solid transparent; border-radius: 9px; cursor: pointer;
  font-family: var(--font-sans); color: var(--sg-fg); transition: .12s;
}
.signature-studio .sg-brand-chip .sg-chip-color { width: 100%; height: 22px; border-radius: 5px; }
.signature-studio .sg-brand-chip .sg-chip-name { font-size: 9px; letter-spacing: .02em; }
.signature-studio .sg-brand-chip.active { border-color: var(--sg-accent); }

.signature-studio .sg-hint { font-size: 10px; color: var(--sg-fg2); line-height: 1.5; margin-top: 7px; }
.signature-studio .sg-hint a { color: var(--sg-accent-text, var(--sg-accent)); text-decoration: none; font-weight: 600; }
.signature-studio .sg-hint a:hover { text-decoration: underline; }

/* Shamwari's dark-mode sodalite accent (#3d5afe) is too mid-toned to pair
 * safely with this app's fixed accent-foreground defaults — confirmed via
 * Mzizi's own contrast checker: near-black button text scores 3.42:1
 * (fails WCAG AA's 4.5:1), and the raw accent as link text on the dark
 * panel scores 3.73:1 (also fails). Every other brand's accent already
 * clears AA against both defaults, so this is a one-brand override, not a
 * global change. Plain white clears the button case (5.13:1); Mzizi's own
 * on_container_dark tone for sodalite (#c5cae9) — designed for exactly
 * this "accent-tinted text on a dark surface" case — clears the link case
 * (11.85:1). */
[data-theme='dark'] .signature-studio[data-brand='shamwari'] {
  --sg-accent-fg: #ffffff;
  --sg-accent-text: #c5cae9;
}

/* Stage */
.signature-studio .sg-stage {
  flex: 1; padding: 24px 20px; display: flex; flex-direction: column; align-items: center; gap: 14px;
  overflow-y: auto; min-height: calc(100dvh - 4rem);
}
.signature-studio .sg-topbar { display: flex; gap: 8px; align-items: center; justify-content: space-between; width: 100%; max-width: 1100px; }

/* Self/Admin mode switch — segmented pill, 48px touch targets. */
.signature-studio .sg-modes {
  display: inline-flex; gap: 4px; padding: 4px;
  background: var(--sg-panel); border: 1px solid var(--sg-line); border-radius: 999px;
}
.signature-studio .sg-mode {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 40px; min-width: 84px; padding: 0 20px; border-radius: 999px; border: 0;
  background: transparent; color: var(--sg-fg2); cursor: pointer;
  font-family: var(--font-mono); font-size: 12px; font-weight: 600; letter-spacing: .04em;
  transition: color .15s, background .15s;
}
.signature-studio .sg-mode:hover { color: var(--sg-fg); }
.signature-studio .sg-mode.active { background: var(--sg-accent); color: var(--sg-accent-fg, var(--primary-foreground)); }
.signature-studio .sg-topbtn {
  background: var(--sg-panel); border: 1px solid var(--sg-line); color: var(--sg-fg2);
  border-radius: 999px; padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: var(--font-mono);
}
.signature-studio .sg-topbtn:hover { color: var(--sg-fg); }
.signature-studio .sg-preview-frame {
  width: 100%; max-width: 1100px; flex: 1; min-height: 240px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 24px 12px;
  background: repeating-conic-gradient(var(--sg-card-check) 0 25%, transparent 0 50%) 0 0 / 22px 22px;
  border-radius: 10px;
}
.signature-studio .sg-card {
  width: 100%; max-width: 600px; background: #FFFFFF; color: #141413;
  border-radius: 10px; padding: 24px 28px; overflow-x: auto;
  box-shadow: 0 6px 36px rgba(0,0,0,.35);
}
.signature-studio .sg-card-note {
  margin: 0; font-family: var(--font-mono); font-size: 10px; letter-spacing: .08em;
  color: var(--sg-fg2); text-align: center;
}
.signature-studio .sg-probe { display: none; }
.signature-studio .sg-error {
  width: 100%; max-width: 1100px; padding: 10px 14px; border-radius: 10px;
  background: var(--destructive-container); color: var(--error); box-shadow: 0 0 0 1px var(--error);
  font-size: 12px;
}
/* Muted alert — Worker {error, detail} messages and insert status land here
 * verbatim (distinct from the louder .sg-error copy failure). */
.signature-studio .sg-alert {
  width: 100%; max-width: 1100px; padding: 10px 14px; border-radius: 10px;
  background: var(--sg-input); border: 1px solid var(--sg-line); color: var(--sg-fg2);
  font-size: 12px; line-height: 1.5; overflow-wrap: anywhere;
}
.signature-studio .sg-meta {
  width: 100%; max-width: 1100px; display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 8px; padding-top: 10px; border-top: 1px solid var(--sg-line);
  font-family: var(--font-mono); font-size: 10px; letter-spacing: .06em; color: var(--sg-fg2); line-height: 1.7;
}
.signature-studio .sg-meta b { color: var(--sg-fg); font-weight: 600; }
.signature-studio .sg-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.signature-studio .sg-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 99px;
  vertical-align: middle; margin-right: 5px;
}
.signature-studio .sg-btn-act {
  display: inline-flex; align-items: center; height: 34px; padding: 0 16px; border-radius: 999px; border: 0;
  font-family: var(--font-sans); font-size: 12px; font-weight: 600; cursor: pointer; transition: opacity .15s;
}
.signature-studio .sg-btn-act.primary { background: var(--sg-accent); color: var(--sg-accent-fg, var(--primary-foreground)); }
.signature-studio .sg-btn-act.ghost { background: transparent; border: 1px solid var(--sg-line); color: var(--sg-fg); }
.signature-studio .sg-btn-act:hover { opacity: .82; }

@media (max-width: 768px) {
  .signature-studio { flex-direction: column; }
  .signature-studio .sg-panel { width: 100%; position: relative; top: 0; max-height: none; border-right: none; border-bottom: 1px solid var(--sg-line); }
  .signature-studio .sg-stage { min-height: 60vh; padding: 14px 12px 28px; }
  .signature-studio .sg-preview-frame { min-height: 200px; flex: none; }
  .signature-studio .sg-meta { flex-direction: column; align-items: stretch; }
  .signature-studio .sg-actions { justify-content: flex-end; }
}
`;export{Y as default};