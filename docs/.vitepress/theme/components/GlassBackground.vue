<template>
  <!--
    液态玻璃动态背景组件 GlassBackground
    - 渲染5个浮动光效球（不同颜色/大小/轨迹）
    - 2条扫光线模拟光线折射
    - 网格纹理层增强玻璃质感
    - 使用 will-change 优化动画性能
    - 暗色主题自动适配光球透明度
  -->
  <div class="glass-background" aria-hidden="true">
    <!-- 动态光效球 -->
    <div class="light-orb orb-1"></div>
    <div class="light-orb orb-2"></div>
    <div class="light-orb orb-3"></div>
    <div class="light-orb orb-4"></div>
    <div class="light-orb orb-5"></div>
    <!-- 流光线条 -->
    <div class="light-beam beam-1"></div>
    <div class="light-beam beam-2"></div>
    <!-- 网格纹理 -->
    <div class="glass-grid"></div>
  </div>
</template>

<script>
export default {
  name: 'GlassBackground'
}
</script>

<style scoped>
.glass-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

/* ========== 动态光效球 ========== */
.light-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
  will-change: transform;
}

.orb-1 {
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(56, 152, 255, 0.4) 0%, transparent 70%);
  top: -10%;
  left: -5%;
  animation: float-1 18s ease-in-out infinite;
}

.orb-2 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(120, 80, 255, 0.35) 0%, transparent 70%);
  top: 30%;
  right: -10%;
  animation: float-2 22s ease-in-out infinite;
}

.orb-3 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(0, 210, 255, 0.3) 0%, transparent 70%);
  bottom: -5%;
  left: 25%;
  animation: float-3 20s ease-in-out infinite;
}

.orb-4 {
  width: 350px;
  height: 350px;
  background: radial-gradient(circle, rgba(160, 120, 255, 0.25) 0%, transparent 70%);
  top: 60%;
  left: 60%;
  animation: float-4 25s ease-in-out infinite;
}

.orb-5 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(0, 180, 220, 0.3) 0%, transparent 70%);
  top: 10%;
  left: 50%;
  animation: float-5 16s ease-in-out infinite;
}

/* ========== 流光线条 ========== */
.light-beam {
  position: absolute;
  background: linear-gradient(90deg, transparent, rgba(100, 180, 255, 0.08), transparent);
  will-change: transform;
}

.beam-1 {
  width: 200%;
  height: 1px;
  top: 35%;
  left: -50%;
  transform: rotate(-15deg);
  animation: sweep-1 12s linear infinite;
}

.beam-2 {
  width: 200%;
  height: 1px;
  top: 65%;
  left: -50%;
  transform: rotate(10deg);
  animation: sweep-2 15s linear infinite;
}

/* ========== 网格纹理 ========== */
.glass-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
}

/* ========== 动画关键帧 ========== */
@keyframes float-1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25%      { transform: translate(80px, 50px) scale(1.1); }
  50%      { transform: translate(30px, 100px) scale(0.95); }
  75%      { transform: translate(-40px, 60px) scale(1.05); }
}

@keyframes float-2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25%      { transform: translate(-60px, 80px) scale(1.08); }
  50%      { transform: translate(-100px, 20px) scale(0.9); }
  75%      { transform: translate(-30px, -40px) scale(1.12); }
}

@keyframes float-3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%      { transform: translate(70px, -60px) scale(1.15); }
  66%      { transform: translate(-50px, -30px) scale(0.92); }
}

@keyframes float-4 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  20%      { transform: translate(-80px, -50px) scale(1.1); }
  40%      { transform: translate(-40px, 40px) scale(0.95); }
  60%      { transform: translate(50px, 20px) scale(1.08); }
  80%      { transform: translate(30px, -30px) scale(0.98); }
}

@keyframes float-5 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  30%      { transform: translate(60px, 70px) scale(1.12); }
  60%      { transform: translate(-40px, 50px) scale(0.88); }
}

@keyframes sweep-1 {
  0%   { transform: rotate(-15deg) translateX(-30%); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: rotate(-15deg) translateX(30%); opacity: 0; }
}

@keyframes sweep-2 {
  0%   { transform: rotate(10deg) translateX(30%); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: rotate(10deg) translateX(-30%); opacity: 0; }
}

/* ========== 暗色主题适配 ========== */
.dark .orb-1 {
  background: radial-gradient(circle, rgba(56, 152, 255, 0.3) 0%, transparent 70%);
}
.dark .orb-2 {
  background: radial-gradient(circle, rgba(120, 80, 255, 0.25) 0%, transparent 70%);
}
.dark .orb-3 {
  background: radial-gradient(circle, rgba(0, 210, 255, 0.2) 0%, transparent 70%);
}
.dark .glass-grid {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
}
</style>
