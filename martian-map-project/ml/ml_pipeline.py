"""Jezero terrain ML: hazard surrogate (gradient boosting), terrain classes (k-means), route comparison.
Usage: python ml_pipeline.py <folder with jezero_*.tif + jezero_routes_v03.json> <output folder>
"""
import sys, os, json, base64, numpy as np, tifffile
from scipy import ndimage as ndi
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import r2_score, mean_absolute_error
from sklearn.model_selection import GroupKFold
from sklearn.inspection import permutation_importance
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from skimage.graph import route_through_array
P=(sys.argv[1] if len(sys.argv)>1 else './data/').rstrip('/')+'/'
OUT=sys.argv[2] if len(sys.argv)>2 else './outputs/';OUT=OUT.rstrip('/')+'/';os.makedirs(OUT,exist_ok=True)
dem=tifffile.imread(P+'jezero_dem_1024.tif').astype(np.float32)
slope=tifffile.imread(P+'jezero_slope.tif');rough=tifffile.imread(P+'jezero_roughness.tif');haz=tifffile.imread(P+'jezero_hazard_score.tif')
# DEM-only multi-scale features (no slope/roughness/hazard inputs -> avoids label leakage)
F={};g=lambda s:ndi.gaussian_filter(dem,s)
for s in (1,2,4,8):
    gy,gx=np.gradient(g(s));F[f'grad_s{s}']=np.hypot(gx,gy)
    F[f'curv_s{s}']=ndi.laplace(g(s))
for s in (3,10,30):F[f'tpi_s{s}']=dem-g(s)
for w in (3,7,15):
    m=ndi.uniform_filter(dem,w);F[f'std_w{w}']=np.sqrt(np.maximum(ndi.uniform_filter(dem**2,w)-m**2,0))
F['elev']=dem
names=list(F);X=np.stack([F[n] for n in names],-1).reshape(-1,len(names));y=haz.reshape(-1)
rr,cc=np.indices(dem.shape);grp=((rr//256)*4+(cc//256)).reshape(-1)  # 16 spatial blocks
rng=np.random.default_rng(0);idx=rng.choice(len(y),60000,replace=False)
mk=lambda:HistGradientBoostingRegressor(max_iter=250,learning_rate=.08,random_state=0)
oof=np.zeros(len(y));folds=[]
for tr,te in GroupKFold(4).split(idx,groups=grp[idx]):
    m=mk().fit(X[idx[tr]],y[idx[tr]]);tei=np.where(np.isin(grp,np.unique(grp[idx[te]])))[0]
    oof[tei]=m.predict(X[tei]);folds.append((r2_score(y[tei],oof[tei]),mean_absolute_error(y[tei],oof[tei])))
cls=lambda a:np.digitize(a,[.33,.66])
acc=float((cls(oof)==cls(y)).mean());base=float((cls(y)==np.bincount(cls(y)).argmax()).mean())
print('spatial-block CV R2 %.3f MAE %.3f class acc %.3f (majority baseline %.3f)'%(r2_score(y,oof),mean_absolute_error(y,oof),acc,base))
model=mk().fit(X[idx],y[idx]);pred=np.clip(model.predict(X),0,1).reshape(dem.shape)
pi=permutation_importance(model,X[idx[:6000]],y[idx[:6000]],n_repeats=3,random_state=0)
imp=sorted(zip(names,pi.importances_mean),key=lambda t:-t[1])[:6]
print(imp)
# unsupervised terrain classes
Z=StandardScaler().fit_transform(np.stack([slope,rough,F['tpi_s30'],F['std_w15']],-1).reshape(-1,4))
km=KMeans(4,n_init=4,random_state=0).fit(Z[idx]);lab=km.predict(Z)
order=np.argsort([slope.reshape(-1)[lab==k].mean() for k in range(4)]);remap=np.zeros(4,int);remap[order]=np.arange(4);lab=remap[lab].reshape(dem.shape)
cstats=[dict(id=i,share=float((lab==i).mean()),slope=float(slope[lab==i].mean()),rough=float(rough[lab==i].mean()),haz=float(haz[lab==i].mean())) for i in range(4)];print(cstats)
# route planning on 256 grid: true vs ML hazard
ds=lambda a,f=4:a.reshape(a.shape[0]//f,f,a.shape[1]//f,f).mean((1,3))
H=ds(haz);Hm=ds(pred);R=json.load(open(P+'jezero_routes_v03.json'));s=tuple(R['start_row_col']);t=tuple(R['goal_row_col'])
def plan(h):return route_through_array(1+5*h,s,t,fully_connected=True,geometric=True)[0]
def cost(p,h):p=np.array(p);d=np.hypot(*np.diff(p,axis=0).T);return float((d*(1+5*(h[p[1:,0],p[1:,1]]+h[p[:-1,0],p[:-1,1]])/2)).sum())
pt,pm=plan(H),plan(Hm);pd_=R['results']['Shortest Dijkstra']['route']
rt=dict(true=dict(len=len(pt),c_true=cost(pt,H),c_ml=cost(pt,Hm)),ml=dict(len=len(pm),c_true=cost(pm,H),c_ml=cost(pm,Hm)),short=dict(len=len(pd_),c_true=cost(pd_,H)))
print(rt)
# export 128x128
d2=lambda a:ds(a,8);q=lambda a,lo,hi:(np.clip((a-lo)/(hi-lo),0,1)*255).astype(np.uint8)
dm=d2(dem);b64=lambda a:base64.b64encode(a.tobytes()).decode()
rs=lambda p:[[int(r/2),int(c/2)] for r,c in p[::2]]
out=dict(n=128,hmin=float(dm.min()),hmax=float(dm.max()),dem=b64(q(dm,dm.min(),dm.max())),haz=b64(q(d2(haz),0,1)),ml=b64(q(d2(pred),0,1)),cl=b64(d2(lab.astype(np.float32)).round().astype(np.uint8)),
 slope=b64(q(d2(slope),0,15)),routes=dict(short=rs(pd_),true=rs(pt),ml=rs(pm)),start=[s[0]//2,s[1]//2],goal=[t[0]//2,t[1]//2],
 ml_metrics=dict(r2=float(r2_score(y,oof)),mae=float(mean_absolute_error(y,oof)),acc=acc,base=base,folds=[[float(a),float(b)] for a,b in folds],imp=[[n,float(v)] for n,v in imp]),clusters=cstats,route_eval=rt,
 stats=dict(elev_range=float(dem.max()-dem.min()),slope_mean=float(slope.mean()),slope_p95=float(np.percentile(slope,95)),rough_mean=float(rough.mean()),haz_mean=float(haz.mean())),
 robust=dict(gain=0.122,ci=[-0.158,0.411],scen=100,kappa=0.5))
tifffile.imwrite(OUT+'ml_hazard_prediction.tif',pred.astype(np.float32));tifffile.imwrite(OUT+'ml_terrain_classes.tif',lab.astype(np.uint8));json.dump(out,open(OUT+'jezero_data.json','w'));print(len(json.dumps(out))//1024,'KB')
