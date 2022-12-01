import * as assert from 'assert';
import { after } from 'mocha';

import {double} from '../../logging';

suite('Extension Test Suite', () => {
  test('Unit 1', () => {
    assert.strictEqual(double(3), 6);
  });

});
