import { testlib1Commonjs } from '@harves/testlib1-commonjs';
import { testlib2Esm } from '@harves/testlib2-esm';
import { nanoid } from 'nanoid';

export function testapp2Esm(): string {
  return (
    'testapp2-esm: ' + [nanoid(), testlib1Commonjs(), testlib2Esm()].join(', ')
  );
}
