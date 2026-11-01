
const KEY="crpf_mess_v3";
let db=JSON.parse(localStorage.getItem(KEY)||"null")||{
 members:[],items:[],purchases:[],recipes:[],meals:[],transactions:[]
};
let draft=[];
const $=id=>document.getElementById(id);
const save=()=>{localStorage.setItem(KEY,JSON.stringify(db));render()};
const money=n=>"Rs "+Number(n||0).toFixed(2);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);

function show(id){
 document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
 $(id).classList.add("active");
 render();
}
function toBase(q,u){
 q=Number(q);
 if(u==="kg")return q*1000;
 if(u==="g")return q;
 if(u==="l")return q*1000;
 if(u==="ml")return q;
 if(u==="pcs")return q;
 throw Error("Invalid unit");
}
function baseUnit(u){return u==="kg"||u==="g"?"g":u==="l"||u==="ml"?"ml":"pcs"}
function unitLabel(u){return u==="g"?"Gram":u==="ml"?"ML":"Piece"}
function itemById(id){return db.items.find(x=>x.id===id)}
function itemRate(item){return item&&item.stock>0?item.value/item.stock:0}

function addMember(){
 let no=$("mno").value.trim(),name=$("mname").value.trim();
 if(!no||!name)return alert("Force number aur naam bhariye");
 if(db.members.some(m=>m.no===no))return alert("Member number already exists");
 db.members.push({id:uid(),no,name,rank:$("mrank").value,phone:$("mphone").value,date:$("mdate").value,balance:0});
 ["mno","mname","mphone","mdate"].forEach(id=>$(id).value="");
 save();
}
function addItem(){
 let name=$("itemName").value.trim(),unit=$("itemUnit").value;
 if(!name)return alert("Item name bhariye");
 if(db.items.some(x=>x.name.toLowerCase()===name.toLowerCase()))return alert("Item already exists");
 db.items.push({id:uid(),name,unit:baseUnit(unit),stock:0,value:0});
 $("itemName").value="";save();
}
function addPurchase(){
 let item=itemById($("pItem").value),qty=Number($("pQty").value),unit=$("pUnit").value,rate=Number($("pRate").value);
 if(!item||qty<=0||rate<0||!Number.isFinite(rate))return alert("Purchase details check karein");
 if(baseUnit(unit)!==item.unit)return alert("Purchase unit item ke unit se match nahi karta");
 let baseQty=toBase(qty,unit),cost=qty*rate;
 item.stock+=baseQty;item.value+=cost;
 db.purchases.unshift({id:uid(),date:$("pDate").value||new Date().toISOString().slice(0,10),item:item.name,qty,unit,rate,cost,supplier:$("pSupplier").value});
 $("pQty").value=$("pRate").value=$("pSupplier").value="";save();
}
function addIngredient(){
 let item=itemById($("rItem").value),qty=Number($("rQty").value),unit=$("rUnit").value;
 if(!item||qty<=0)return alert("Ingredient details check karein");
 if(baseUnit(unit)!==item.unit)return alert("Ingredient unit item type se match nahi karta");
 draft.push({itemId:item.id,qty:toBase(qty,unit),unit:unit,name:item.name});
 $("rQty").value="";renderDraft();
}
function renderDraft(){
 $("ingredientDraft").innerHTML=draft.map((x,i)=>`<p>${esc(x.name)} — ${x.qty} ${x.unit} <button class="danger" onclick="draft.splice(${i},1);renderDraft()">Remove</button></p>`).join("");
}
function saveRecipe(){
 let name=$("rName").value.trim();
 if(!name||!draft.length)return alert("Recipe name aur ingredients add karein");
 db.recipes.push({id:uid(),name,ingredients:draft.map(x=>({...x}))});
 draft=[];$("rName").value="";renderDraft();save();
}
function recipeCost(r){
 return r.ingredients.reduce((sum,x)=>{
 let item=itemById(x.itemId);return sum+x.qty*itemRate(item);
 },0);
}
function mealCost(){
 let r=db.recipes.find(x=>x.id===$("mealRecipe").value),n=Number($("mealServings").value);
 if(!r||n<=0)return null;
 return {r,n,cost:recipeCost(r)*n};
}
function showMealCost(){
 let m=mealCost();if(!m)return alert("Recipe aur servings select karein");
 $("mealPreview").innerHTML=`Total cost: <b>${money(m.cost)}</b> | Per serving: ${money(recipeCost(m.r))}`;
 $("mealMembers").innerHTML="<b>Meal charge members:</b>"+db.members.map(x=>`<label><input type="checkbox" class="mealMember" value="${x.id}" checked> ${esc(x.name)} (${esc(x.no)})</label>`).join("");
}
function confirmMeal(){
 let m=mealCost();if(!m)return alert("Meal details check karein");
 let ids=[...document.querySelectorAll(".mealMember:checked")].map(x=>x.value);
 if(!ids.length)return alert("Members select karein");
 for(let x of m.r.ingredients){
  let item=itemById(x.itemId),need=x.qty*m.n;
  if(!item||item.stock<need)return alert("Stock kam hai: "+(item?.name||"item"));
 }
 m.r.ingredients.forEach(x=>{
  let item=itemById(x.itemId),need=x.qty*m.n;
  item.stock-=need;item.value=Math.max(0,item.value-need*itemRate(item));
 });
 let share=m.cost/ids.length;
 ids.forEach(id=>{
  let member=db.members.find(x=>x.id===id);
  member.balance-=share;
  db.transactions.unshift({id:uid(),date:$("mealDate").value||new Date().toISOString().slice(0,10),type:"meal",member:member.name,amount:share,note:"Meal: "+m.r.name});
 });
 db.meals.unshift({id:uid(),date:$("mealDate").value||new Date().toISOString().slice(0,10),type:$("mealType").value,recipe:m.r.name,servings:m.n,cost:m.cost,members:ids.length});
 $("mealPreview").innerHTML="Meal confirmed. Stock deducted.";
 save();
}
function addTransaction(){
 let member=db.members.find(x=>x.id===$("aMember").value),type=$("aType").value,amount=Number($("aAmount").value);
 if(amount<=0)return alert("Amount bhariye");
 if(type==="deposit"&&!member)return alert("Member select karein");
 if(type==="deposit")member.balance+=amount;
 db.transactions.unshift({id:uid(),date:new Date().toISOString().slice(0,10),type,member:member?.name||"Mess",amount,note:$("aNote").value});
 $("aAmount").value=$("aNote").value="";save();
}
function table(headers,rows){
 return `<div class="wrap"><table><thead><tr>${headers.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function render(){
 $("stats").innerHTML=[
 ["Members",db.members.length],
 ["Ration Items",db.items.length],
 ["Stock Value",money(db.items.reduce((s,x)=>s+x.value,0))],
 ["Meals",db.meals.length],
 ["Member Due",money(db.members.reduce((s,x)=>s+Math.max(0,-x.balance),0))]
 ].map(x=>`<div class="metric">${x[0]}<b>${x[1]}</b></div>`).join("");

 $("memberList").innerHTML=table(["Force No","Name","Rank","Advance / Balance"],db.members.map(m=>[esc(m.no),esc(m.name),esc(m.rank),money(m.balance)]));
 $("storeList").innerHTML=table(["Item","Stock","Average Rate","Stock Value"],db.items.map(x=>[esc(x.name),x.stock.toFixed(2)+" "+unitLabel(x.unit),money(itemRate(x))+" / "+unitLabel(x.unit),money(x.value)]));
 $("purchaseList").innerHTML=table(["Date","Item","Purchase","Rate","Total","Supplier"],db.purchases.map(x=>[x.date,esc(x.item),x.qty+" "+x.unit,money(x.rate),money(x.cost),esc(x.supplier)]));
 $("recipeList").innerHTML=db.recipes.map(r=>`<div class="card"><b>${esc(r.name)}</b><p>${r.ingredients.map(x=>esc(x.name)+" "+x.qty+" "+unitLabel(baseUnit(x.unit))).join(", ")}</p>Cost per serving: <b>${money(recipeCost(r))}</b></div>`).join("");
 $("mealList").innerHTML=table(["Date","Meal","Recipe","Servings","Cost","Members"],db.meals.map(x=>[x.date,x.type,esc(x.recipe),x.servings,money(x.cost),x.members]));
 $("accountList").innerHTML=table(["Date","Type","Member / Details","Amount"],db.transactions.map(x=>[x.date,x.type,esc(x.member+" "+(x.note||"")),money(x.amount)]));
 $("recent").innerHTML=db.transactions.slice(0,5).map(x=>`<p>${x.date} — ${esc(x.note||x.type)} — ${money(x.amount)}</p>`).join("");

 $("pItem").innerHTML=db.items.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("");
 $("rItem").innerHTML=$("pItem").innerHTML;
 $("mealRecipe").innerHTML=db.recipes.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("");
 $("aMember").innerHTML=db.members.map(x=>`<option value="${x.id}">${esc(x.name)} (${esc(x.no)})</option>`).join("");
 $("mealMembers").innerHTML=db.members.map(x=>`<label><input type="checkbox" class="mealMember" value="${x.id}" checked> ${esc(x.name)}</label>`).join("");
}
function downloadBackup(){
 let blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"});
 let a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="CRPF_MESS_BACKUP.json";a.click();URL.revokeObjectURL(a.href);
}
function restoreBackup(){
 let file=$("restoreFile").files[0];if(!file)return alert("Backup file select karein");
 let reader=new FileReader();
 reader.onload=()=>{try{
  let data=JSON.parse(reader.result);
  if(!data.members||!data.items||!data.purchases||!data.recipes)throw Error();
  if(!confirm("Current data replace hoga. Continue?"))return;
  db=data;save();alert("Backup restored");
 }catch(e){alert("Invalid backup file")}};
 reader.readAsText(file);
}
render();
