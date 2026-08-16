import { describe, it, expect } from 'vitest';
import { maskPii, maskIdCard, maskPhone, maskInsuranceNo, maskInpatientNo, maskName } from './patterns';

describe('maskPii 确定性正则（与 M3/M2 掩码口径同源）', () => {
  it('掩码身份证', () => {
    expect(maskPii('身份证110101199001011234')).toBe('身份证1101**********1234');
    expect(maskIdCard('110101199001011234')).toBe('1101**********1234');
    expect(maskIdCard('11010119900101123X')).toBe('1101**********123X');
  });

  it('掩码手机号', () => {
    expect(maskPii('手机13800138000')).toBe('手机138****8000');
    expect(maskPhone('13800138000')).toBe('138****8000');
  });

  it('掩码医保号', () => {
    expect(maskPii('医保B123456')).toBe('医保B1****56');
    expect(maskInsuranceNo('B123456')).toBe('B1****56');
  });

  it('掩码住院号', () => {
    expect(maskPii('住院号ZY20260814001')).toBe('住院号ZY*******4001');
    expect(maskInpatientNo('ZY20260814001')).toBe('ZY*******4001');
    expect(maskPii('住院号AX0605264')).toBe('住院号AX***5264');
  });

  it('不误伤临床数字', () => {
    expect(maskPii('血压120/80，剂量5mg，体温36.5℃')).toBe('血压120/80，剂量5mg，体温36.5℃');
  });

  it('掩码姓名（与 M2 maskName 同源：首字 + *）', () => {
    expect(maskName('张伟')).toBe('张*');
    expect(maskName('欧阳娜娜')).toBe('欧*');
    expect(maskName('李小明')).toBe('李*');
    expect(maskName(' 张伟 ')).toBe('张*');
    expect(maskName('')).toBe('');
  });

  it('空文本与无 PII 文本原样返回', () => {
    expect(maskPii('')).toBe('');
    expect(maskPii('患者情况稳定')).toBe('患者情况稳定');
  });
});
