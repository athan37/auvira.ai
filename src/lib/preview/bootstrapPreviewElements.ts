/**
 * Shared preview element bootstrap + leaf inference rules (unit-tested).
 * Runtime bridge embeds the JS mirror via buildUniversalBootstrapBridgeScript().
 */

export interface CtaFieldPathInput {
  href?: string;
  analyticsId?: string;
  analyticsType?: string;
  analyticsLabel?: string;
}

/** Map CTA analytics attrs / href to siteConfig field paths. */
export function mapCtaFieldPath(input: CtaFieldPathInput): string | undefined {
  const analyticsId = (input.analyticsId ?? '').trim().toLowerCase();
  const href = (input.href ?? '').trim().toLowerCase();
  const analyticsType = (input.analyticsType ?? '').trim().toLowerCase();

  if (analyticsId.includes('cta_hero_primary') || analyticsId.includes('cta_nav_primary')) {
    return 'hero.primaryCta';
  }
  if (analyticsId.includes('cta_hero_secondary')) {
    return 'hero.secondaryCta';
  }
  if (analyticsId.includes('cta_contact_primary') || analyticsId.includes('cta_contact')) {
    return 'hero.primaryCta';
  }
  if (analyticsId.includes('cta_contact_phone') || analyticsId.includes('phone')) {
    return 'contact.phone';
  }
  if (href.startsWith('tel:')) {
    return 'contact.phone';
  }
  if (href.startsWith('mailto:')) {
    return 'contact.email';
  }
  if (href === '#contact' && (analyticsType === 'cta' || analyticsId.includes('cta'))) {
    return 'hero.primaryCta';
  }
  if (href === '#contact') {
    return 'hero.primaryCta';
  }
  return undefined;
}

/** Whether a tag name is a meaningful draggable leaf for inference. */
export function isMeaningfulLeafTag(tagName: string): boolean {
  const tag = tagName.toUpperCase();
  return (
    tag === 'A' ||
    tag === 'BUTTON' ||
    /^H[1-4]$/.test(tag) ||
    tag === 'P' ||
    tag === 'FIGCAPTION' ||
    tag === 'IMG'
  );
}

/** Map visible contact row text to siteConfig field path (placeholder-safe). */
export function inferContactFieldPathFromText(text: string): 'contact.phone' | 'contact.email' | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (/@/.test(trimmed)) return 'contact.email';
  if (/phone|tel|call/i.test(trimmed)) return 'contact.phone';
  return 'contact.phone';
}

/** Infer element kind from DOM tag + attrs. */
export function inferElementKindFromTag(
  tagName: string,
  href?: string
): 'button' | 'heading' | 'body' | 'image_caption' | 'contact_field' {
  const tag = tagName.toUpperCase();
  if (tag === 'A' || tag === 'BUTTON') {
    if (href?.startsWith('tel:') || href?.startsWith('mailto:')) {
      return 'contact_field';
    }
    return 'button';
  }
  if (/^H[1-4]$/.test(tag)) return 'heading';
  if (tag === 'IMG') return 'image_caption';
  return 'body';
}

/** JavaScript helpers injected into the preview iframe bridge. */
export function buildUniversalBootstrapBridgeScript(): string {
  return `
function mapCtaFieldPathJs(href,analyticsId,analyticsType){
  var aid=(analyticsId||"").toLowerCase();
  var h=(href||"").toLowerCase();
  var at=(analyticsType||"").toLowerCase();
  if(aid.indexOf("cta_hero_primary")>=0||aid.indexOf("cta_nav_primary")>=0)return "hero.primaryCta";
  if(aid.indexOf("cta_hero_secondary")>=0)return "hero.secondaryCta";
  if(aid.indexOf("cta_contact_primary")>=0||aid.indexOf("cta_contact")>=0)return "hero.primaryCta";
  if(aid.indexOf("cta_contact_phone")>=0||aid.indexOf("phone")>=0)return "contact.phone";
  if(h.indexOf("tel:")===0)return "contact.phone";
  if(h.indexOf("mailto:")===0)return "contact.email";
  if(h==="#contact"&&(at==="cta"||aid.indexOf("cta")>=0))return "hero.primaryCta";
  if(h==="#contact")return "hero.primaryCta";
  return null;
}

function findDraggableRoot(target){
  var node=target;
  while(node&&node!==document.body){
    if(node.getAttribute&&node.getAttribute("data-site-section-id"))return {el:node,type:"section"};
    if(node.tagName==="SECTION")return {el:node,type:"section"};
    if(node.id&&/^(hero|services|about|features|faq|testimonials|contact|gallery)$/i.test(node.id))return {el:node,type:"section"};
    if(node.tagName==="NAV")return {el:node,type:"nav"};
    node=node.parentElement;
  }
  return null;
}

function inferLeafKindFromTag(tag,href){
  tag=(tag||"").toUpperCase();
  if(tag==="A"||tag==="BUTTON"){
    if(href&&href.indexOf("tel:")===0||href&&href.indexOf("mailto:")===0)return "contact_field";
    return "button";
  }
  if(/^H[1-4]$/.test(tag))return "heading";
  if(tag==="IMG")return "image_caption";
  return "body";
}

function inferContactFieldPathFromTextJs(text){
  var t=(text||"").trim();
  if(!t)return null;
  if(t.indexOf("@")>=0)return "contact.email";
  if(/phone|tel|call/i.test(t))return "contact.phone";
  return "contact.phone";
}

function isContactValueRow(el){
  if(!el||!el.getAttribute)return false;
  if(el.getAttribute("data-site-element-kind")==="contact_field")return true;
  var cls=el.className||"";
  return el.tagName==="DIV"&&cls.indexOf("rounded-2xl")>=0&&cls.indexOf("p-4")>=0;
}

function inferLeafTarget(rootEl,target,sectionIndex){
  if(!rootEl||!target)return null;
  var node=target;
  while(node&&node!==rootEl){
    if(!node.tagName){node=node.parentElement;continue;}
    var tag=node.tagName.toUpperCase();
    var href=node.getAttribute?node.getAttribute("href")||"": "";
    var annotatedKind=node.getAttribute("data-site-element-kind");
    if(annotatedKind==="contact_field"||annotatedKind==="button"){
      var annLabel=(node.getAttribute("data-site-element-label")||node.textContent||"").trim();
      var annFp=node.getAttribute("data-site-config-field-path")||"";
      return {
        role:"element",
        kind:annotatedKind,
        label:annLabel||annotatedKind,
        fieldPath:annFp||undefined,
        surfaceId:node.getAttribute("data-site-surface-id")||undefined
      };
    }
    if(tag==="DIV"&&isContactValueRow(node)){
      var rowText=(node.textContent||"").trim();
      if(rowText){
        var rowFp=node.getAttribute("data-site-config-field-path")||inferContactFieldPathFromTextJs(rowText);
        return {
          role:"element",
          kind:"contact_field",
          label:rowText.slice(0,80),
          fieldPath:rowFp||undefined,
          surfaceId:rowFp?surfaceIdFromFieldPath(rowFp):undefined
        };
      }
    }
    var isLeaf=tag==="A"||tag==="BUTTON"||/^H[1-4]$/.test(tag)||tag==="P"||tag==="FIGCAPTION"||tag==="IMG";
    if(isLeaf){
      var label=(node.textContent||"").trim()||node.getAttribute("alt")||node.getAttribute("data-analytics-label")||"";
      if(!label&&tag!=="IMG"){node=node.parentElement;continue;}
      var analyticsId=node.getAttribute("data-analytics-id")||"";
      var analyticsType=node.getAttribute("data-analytics-type")||"";
      var existingFp=node.getAttribute("data-site-config-field-path")||"";
      var fp=existingFp||mapCtaFieldPathJs(href,analyticsId,analyticsType);
      if(!fp&&/^H[1-4]$/.test(tag)&&Number.isFinite(sectionIndex)&&sectionIndex>=0){
        fp=tag==="H2"?"sections["+sectionIndex+"].title":tag==="H3"?"sections["+sectionIndex+"].subtitle":"sections["+sectionIndex+"].title";
      }
      if(!fp&&tag==="P"&&Number.isFinite(sectionIndex)&&sectionIndex>=0)fp="sections["+sectionIndex+"].body";
      var kind=node.getAttribute("data-site-element-kind")||inferLeafKindFromTag(tag,href);
      return {
        role:"element",
        kind:kind,
        label:label||kind,
        fieldPath:fp||undefined,
        surfaceId:fp?surfaceIdFromFieldPath(fp):undefined
      };
    }
    if(hasCardClassHint(node)){
      var cardLabel=(node.textContent||"").trim().slice(0,80)||"Card";
      return {role:"element",kind:"item_card",label:cardLabel};
    }
    node=node.parentElement;
  }
  return null;
}

function bootstrapCtaLink(link,defaultLabel,defaultFieldPath){
  if(!link||link.getAttribute("data-site-element-kind"))return;
  var href=link.getAttribute("href")||"";
  var analyticsId=link.getAttribute("data-analytics-id")||"";
  var analyticsType=link.getAttribute("data-analytics-type")||"";
  var analyticsLabel=link.getAttribute("data-analytics-label")||"";
  var label=analyticsLabel||(link.textContent||"").trim()||defaultLabel;
  var fp=mapCtaFieldPathJs(href,analyticsId,analyticsType)||defaultFieldPath;
  if(!fp)return;
  var kind=href.indexOf("tel:")===0||href.indexOf("mailto:")===0?"contact_field":"button";
  setElementAttr(link,kind,label,fp);
}

function bootstrapUniversalElements(sectionEl,sectionIndex){
  var h2=sectionEl.querySelector("h2");
  if(h2&&!h2.getAttribute("data-site-element-kind")){
    var titleText=(h2.textContent||"").trim()||"Section title";
    setElementAttr(h2,"heading",titleText,"sections["+sectionIndex+"].title");
  }
  var intro=sectionEl.querySelector("h2 + p, p.mt-6");
  if(intro&&!intro.getAttribute("data-site-element-kind")){
    var introText=(intro.textContent||"").trim();
    if(introText)setElementAttr(intro,"body",introText,"sections["+sectionIndex+"].body");
  }
  var ctas=sectionEl.querySelectorAll('a[data-analytics-type="cta"],a[href="#contact"],a[href^="tel:"],a[href^="mailto:"]');
  for(var ci=0;ci<ctas.length;ci++)bootstrapCtaLink(ctas[ci],"Primary button","hero.primaryCta");
  var h3=sectionEl.querySelector("h3");
  if(h3&&!h3.getAttribute("data-site-element-kind")){
    var subText=(h3.textContent||"").trim();
    if(subText)setElementAttr(h3,"heading",subText,"sections["+sectionIndex+"].subtitle");
  }
}

function bootstrapHeroSection(heroEl){
  var h1=heroEl.querySelector("h1");
  if(h1&&!h1.getAttribute("data-site-element-kind")){
    var headline=(h1.textContent||"").trim()||"Headline";
    setElementAttr(h1,"heading",headline,"hero.headline");
  }
  var sub=heroEl.querySelector("h1 + p, p.text-lg, p.text-xl");
  if(sub&&!sub.getAttribute("data-site-element-kind")){
    var subText=(sub.textContent||"").trim();
    if(subText)setElementAttr(sub,"body",subText,"hero.subheadline");
  }
  var heroCtas=heroEl.querySelectorAll('a[data-analytics-type="cta"],a[href="#contact"],a[href^="tel:"]');
  for(var hi=0;hi<heroCtas.length;hi++){
    var hc=heroCtas[hi];
    var hAid=hc.getAttribute("data-analytics-id")||"";
    var defaultFp=hAid.indexOf("secondary")>=0?"hero.secondaryCta":"hero.primaryCta";
    bootstrapCtaLink(hc,"Hero CTA",defaultFp);
  }
}

function bootstrapContactValueRows(scopeEl){
  if(!scopeEl)return;
  var rows=scopeEl.querySelectorAll(".rounded-2xl, .space-y-4 > div, [data-site-element-kind='contact_field']");
  var phoneTagged=false,emailTagged=false,extraIndex=0;
  for(var j=0;j<rows.length;j++){
    var row=rows[j];
    if(row.getAttribute("data-site-element-kind"))continue;
    if(!isContactValueRow(row))continue;
    var text=(row.textContent||"").trim();
    if(!text)continue;
    var fp=row.getAttribute("data-site-config-field-path")||"";
    var sid="";
    if(!fp){
      if(!emailTagged&&/@/.test(text)){
        fp="contact.email";
        emailTagged=true;
      }else if(!phoneTagged){
        fp="contact.phone";
        phoneTagged=true;
      }else if(!emailTagged&&/@/.test(text)){
        fp="contact.email";
        emailTagged=true;
      }else{
        fp="contact.extraLines["+extraIndex+"]";
        sid="contact-extra-"+extraIndex;
        extraIndex++;
      }
    }
    sid=row.getAttribute("data-site-surface-id")||sid||(fp.indexOf("extraLines")>=0?"contact-extra-line":("contact-"+(fp.split(".")[1]||"line")+"-card"));
    setElementAttr(row,"contact_field",text.slice(0,80),fp,undefined,sid);
  }
}

function bootstrapHeroContactFields(heroEl){
  var card=heroEl.querySelector(".rounded-\\[2rem\\]")||heroEl.querySelector("[class*='rounded-[2rem]']");
  bootstrapContactValueRows(card||heroEl);
}

function bootstrapContactExtras(sectionEl,sectionIndex){
  var innerCard=sectionEl.querySelector("[data-site-container-kind='inner_card']");
  if(!innerCard){
    var cards=sectionEl.querySelectorAll(".rounded-\\[2rem\\], .rounded-2xl.border");
    for(var c=0;c<cards.length;c++){
      if(cards[c].querySelector("h3")){innerCard=cards[c];break;}
    }
  }
  if(innerCard&&!innerCard.getAttribute("data-site-container-kind")){
    innerCard.setAttribute("data-site-container-kind","inner_card");
    innerCard.setAttribute("data-site-container-label","Contact card");
  }
  var phoneLink=sectionEl.querySelector('a[href^="tel:"]');
  if(phoneLink)bootstrapCtaLink(phoneLink,"Phone button","contact.phone");
  bootstrapContactValueRows(innerCard||sectionEl);
}

function bootstrapNavElements(navEl){
  var brand=navEl.querySelector("a.font-bold, a.text-xl, a[href='#'], nav > div > a:first-child");
  if(brand&&!brand.getAttribute("data-site-element-kind")){
    var brandText=(brand.textContent||"").trim();
    if(brandText)setElementAttr(brand,"heading",brandText,"siteConfig.businessName");
  }
  var navCtas=navEl.querySelectorAll('a[data-analytics-type="cta"],a[href="#contact"],a[href^="tel:"]');
  for(var ni=0;ni<navCtas.length;ni++)bootstrapCtaLink(navCtas[ni],"Navigation CTA","hero.primaryCta");
}

function bootstrapElementAttrsUniversal(){
  var navEl=document.querySelector("nav");
  if(navEl)bootstrapNavElements(navEl);
  var sections=allSections();
  for(var s=0;s<sections.length;s++){
    var sectionEl=sections[s];
    var idx=sectionIndexFromEl(sectionEl);
    if(!Number.isFinite(idx)||idx<0){
      if(sectionEl.id==="hero"||sectionEl.getAttribute("data-analytics-type")==="hero"){
        bootstrapHeroSection(sectionEl);
        bootstrapHeroContactFields(sectionEl);
      }
      continue;
    }
    var type=(sectionEl.getAttribute("data-site-section-type")||sectionEl.id||"").toLowerCase();
    bootstrapUniversalElements(sectionEl,idx);
    if(type==="hero"||sectionEl.id==="hero"){
      bootstrapHeroSection(sectionEl);
      bootstrapHeroContactFields(sectionEl);
    }
    if(type==="contact"||sectionEl.id==="contact")bootstrapContactExtras(sectionEl,idx);
    else if(/services|about|features|faq|testimonials|generic|gallery/.test(type))bootstrapItemCards(sectionEl,idx);
  }
}
`.trim();
}
