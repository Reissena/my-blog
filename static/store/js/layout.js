// ---------------------------------------------------------------------------
// layout.js — 街区尺寸与分区（所有模块共享的空间约定）
//     +X / +Z 两个临街面；单位约为米
// ---------------------------------------------------------------------------
export const L = {
  baseHalf: 26,
  roadY: -0.15,      // 沥青路面
  walkY: 0,          // 人行道 / 店铺地面

  block: { x0: -19, x1: 8, z0: -17, z1: 9 },       // 店铺所在的街区（人行道）
  eastRoad: { x0: 8, x1: 20 },
  southRoad: { z0: 9, z1: 21 },
  farEast: { x0: 20, x1: 26 },
  farSouth: { z0: 21, z1: 26 },

  store: { x0: -8, x1: 4, z0: -6, z1: 6, wallH: 3.55, roofTop: 3.84 },

  // 樱花树：沿人行道边缘，树冠抬高，避免遮挡招牌与橱窗
  trees: [
    { x: -14.4, z: 7.1, scale: 1.0, seed: 11, lean: -0.06 },
    { x: -16.7, z: -3.4, scale: 0.9, seed: 27, lean: 0.05 },
    { x: -17.4, z: -14.2, scale: 0.8, seed: 41, lean: -0.03 },
    { x: 6.35, z: -12.6, scale: 0.95, seed: 58, lean: 0.04 },
    { x: -8.8, z: -15.0, scale: 0.92, seed: 73, lean: -0.05 },
  ],

  // 路灯位置（灯头伸向车道）
  streetLamps: [
    { x: -6.2, z: 8.7, rot: 0 },
    { x: 7.6, z: -6.5, rot: Math.PI / 2 },
    { x: 7.6, z: 6.9, rot: Math.PI / 2 },
  ],
};

export const inBlock = (x, z) =>
  x >= L.block.x0 && x <= L.block.x1 && z >= L.block.z0 && z <= L.block.z1;

export const inEastRoad = (x, z) =>
  x >= L.eastRoad.x0 && x <= L.eastRoad.x1 && z >= -L.baseHalf && z <= L.baseHalf;

export const inSouthRoad = (x, z) =>
  z >= L.southRoad.z0 && z <= L.southRoad.z1 && x >= -L.baseHalf && x <= L.baseHalf;

export const inFarEast = (x, z) => x >= L.farEast.x0 && x <= L.baseHalf;
export const inFarSouth = (x, z) => z >= L.farSouth.z0 && z <= L.baseHalf;

export const inStore = (x, z) =>
  x > L.store.x0 - 0.6 && x < L.store.x1 + 0.6 && z > L.store.z0 - 0.6 && z < L.store.z1 + 0.6;
