/**
 * 确定性 PII 正则与掩码（DSH 侧轻量正则脱敏，TDD 指南 US-M1-01 / M1-T1）。
 *
 * 与 M3 `PiiPatternDetector` / M2 `McpOutputDesensitizer` 掩码口径**同源**：
 * 身份证 / 手机 / 医保 / 住院号。前端减负，**不做阻断**（阻断职责在 M3）。
 */

const ID_CARD = /(?<!\d)\d{17}[\dXx](?!\d)/g;
const PHONE = /(?<!\d)1[3-9]\d{9}(?!\d)/g;
const INPATIENT_NO = /(?<![A-Za-z0-9])[A-Za-z]{2}\d{7,}(?![A-Za-z0-9])/g;
const INSURANCE_NO = /(?<![A-Za-z0-9])[A-Za-z]\d{6,}(?![A-Za-z0-9])/g;

/** 保留头尾、中间 * 填充（与 M2 maskKeepHeadTail 一致） */
function keepHeadTail(value: string, head: number, tail: number): string {
  const s = value.trim();
  if (s.length <= head + tail) {
    return s.charAt(0) + '*'.repeat(Math.max(1, s.length - 1));
  }
  return s.slice(0, head) + '*'.repeat(s.length - head - tail) + s.slice(-tail);
}

/** 保留头尾、中间固定 4 个 *（与 M2 maskKeepHeadTail(filler=4) 一致） */
function keepHeadTailFixed(value: string, head: number, tail: number): string {
  const s = value.trim();
  if (s.length <= head + tail) {
    return s.charAt(0) + '*'.repeat(Math.max(1, s.length - 1));
  }
  return s.slice(0, head) + '****' + s.slice(-tail);
}

/** 身份证掩码：110101199001011234 → 1101**********1234 */
export function maskIdCard(idCard: string): string {
  return keepHeadTail(idCard, 4, 4);
}

/** 手机掩码：13800138000 → 138****8000 */
export function maskPhone(phone: string): string {
  return keepHeadTailFixed(phone, 3, 4);
}

/** 医保号掩码：B123456 → B1****56 */
export function maskInsuranceNo(insuranceNo: string): string {
  return keepHeadTailFixed(insuranceNo, 2, 2);
}

/** 住院号掩码：ZY20260814001 → ZY*******4001 */
export function maskInpatientNo(inpatientNo: string): string {
  return keepHeadTail(inpatientNo, 2, 4);
}

/**
 * 姓名掩码：保留首字，其余以单个 * 替代（与 M2 `McpOutputDesensitizer.maskName` 同源）。
 * “张伟” → “张*”，“欧阳娜娜” → “欧*”，“李小明” → “李*”。
 */
export function maskName(name: string): string {
  const s = name.trim();
  if (!s) return name;
  return s.charAt(0) + '*';
}

/**
 * 轻量正则掩码入口：文本中的身份证/手机/医保/住院号全部掩码。
 * 不误伤临床数字（血压 120/80、剂量 5mg 等）。
 */
export function maskPii(text: string): string {
  if (!text) return text;
  return text
    .replace(ID_CARD, (m) => maskIdCard(m))
    .replace(PHONE, (m) => maskPhone(m))
    .replace(INPATIENT_NO, (m) => maskInpatientNo(m))
    .replace(INSURANCE_NO, (m) => maskInsuranceNo(m));
}
