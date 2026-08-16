import { describe, it, expect } from 'vitest';
import { applyNameMapping, SessionNameMapper } from './mapper';

describe('applyNameMapping 姓名映射消费', () => {
  it('命中 应替换为泛化指代', () => {
    const r = applyNameMapping('3床张伟的检验结果', { 张伟: '3床患者' });
    expect(r.text).toBe('3床3床患者的检验结果');
    expect(r.count).toBe(1);
  });

  it('长名优先 防子串误替换', () => {
    const r = applyNameMapping('张伟华与张伟', { 张伟: '3床患者', 张伟华: '4床患者' });
    expect(r.text).toBe('4床患者与3床患者');
    expect(r.count).toBe(2);
  });

  it('映射为空 应降级原样返回不抛异常', () => {
    const r = applyNameMapping('张伟的检验结果', {});
    expect(r.text).toBe('张伟的检验结果');
    expect(r.count).toBe(0);
  });

  it('未传映射 应原样返回', () => {
    const r = applyNameMapping('张伟');
    expect(r.text).toBe('张伟');
    expect(r.count).toBe(0);
  });
});

describe('SessionNameMapper 会话级内存映射', () => {
  it('注册后 按会话替换', () => {
    const mapper = new SessionNameMapper();
    mapper.register('s1', { 张伟: '3床患者' });
    expect(mapper.apply('张伟的检验结果', 's1').text).toBe('3床患者的检验结果');
    expect(mapper.knownNames('s1')).toEqual(['张伟']);
  });

  it('未注册会话 降级纯正则', () => {
    const mapper = new SessionNameMapper();
    expect(mapper.apply('张伟', 'no-session').text).toBe('张伟');
    expect(mapper.knownNames('no-session')).toEqual([]);
  });
});
