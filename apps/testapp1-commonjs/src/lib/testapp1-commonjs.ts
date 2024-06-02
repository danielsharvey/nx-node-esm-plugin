import { testlib1Commonjs } from '@harves/testlib1-commonjs';
import { type testlib2Esm } from '@harves/testlib2-esm';
import { type nanoid } from 'nanoid';

const dynamicImport = new Function('specifier', 'return import(specifier)');

export async function testapp1Commonjs(): Promise<string> {
  const _nanoid = (await dynamicImport('nanoid')).nanoid as typeof nanoid;

  const _testlib2Esm = (await dynamicImport('@harves/testlib2-esm'))
    .testlib2Esm as typeof testlib2Esm;

  return (
    'testapp1-commonjs: ' +
    [await _nanoid(), testlib1Commonjs(), await _testlib2Esm()].join(', ')
  );
}
