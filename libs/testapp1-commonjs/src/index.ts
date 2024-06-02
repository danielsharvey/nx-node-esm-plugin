import { testapp1Commonjs } from "./lib/testapp1-commonjs";

(async function() {
  console.log('TEST', await testapp1Commonjs());
})();
