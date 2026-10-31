/**
 * 离线断言：jsonMode 提示必含小写 "json"，虚拟董事会回复提示同样合规。
 * 用法：node scripts/assertJsonModeKeyword.mjs
 */
import {
  ensureJsonKeywordForJsonMode,
  JSON_OBJECT_HINT_MARKER,
  isJsonObjectParamError,
} from '../src/lib/llmGateway.js';
import {
  WAR_ROOM_ASK_SYSTEM_PROMPT,
  WAR_ROOM_SINGLE_REPLY_SYSTEM_PROMPT,
} from '../src/lib/businessModelWarRoomPrompts.js';

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('OK:', msg);
  }
}

// 1) 空提示在 jsonMode 下必被注入小写 json
{
  const { system, user } = ensureJsonKeywordForJsonMode('', 'hello', true);
  const joined = `${system}\n${user}`;
  assert(joined.includes(JSON_OBJECT_HINT_MARKER), '注入标记存在');
  assert(/\bjson\b/.test(joined), '含小写字面量 json');
  assert(/\bjson\b/.test(user), 'user 侧含小写 json（防 system 截断）');
}

// 2) 幂等：重复调用不叠多层标记
{
  const once = ensureJsonKeywordForJsonMode('sys', 'usr', true);
  const twice = ensureJsonKeywordForJsonMode(once.system, once.user, true);
  const c1 = (once.system.match(/llmGateway:require_json/g) || []).length;
  const c2 = (twice.system.match(/llmGateway:require_json/g) || []).length;
  assert(c1 === 1 && c2 === 1, '标记幂等不重复叠加');
}

// 3) 非 jsonMode 不改写
{
  const { system, user } = ensureJsonKeywordForJsonMode('S', 'U', false);
  assert(system === 'S' && user === 'U', 'jsonMode=false 不改写');
}

// 4) 虚拟董事会提示自身含小写 json（不依赖网关注入也能过通义校验）
assert(/\bjson\b/.test(WAR_ROOM_ASK_SYSTEM_PROMPT), 'ASK 提示含小写 json');
assert(/\bjson\b/.test(WAR_ROOM_SINGLE_REPLY_SYSTEM_PROMPT), 'SINGLE_REPLY 提示含小写 json');

// 5) 错误识别覆盖 29 号日志原文
assert(
  isJsonObjectParamError(
    new Error(
      "<400> InternalError.Algo.InvalidParameter: 'messages' must contain the word 'json' in some form, to use 'response_format' of type 'json_object'."
    )
  ),
  '识别 29 号日志 InvalidParameter'
);

if (!process.exitCode) console.log('\n全部断言通过');
