import store from './storage';
import { getToday } from './utils';

const date = getToday();

const addTimerData = res => {
  const time = new Date().toLocaleTimeString();
  const transData = {
    time,
    data: res,
  };
  return transData;
};
let isInit = false;
const init = () => {
  if (isInit) {
    return;
  }
  isInit = true;
  const oldLog = console.log;
  console.log = (...args) => {
    let arr = [];
    oldLog.apply(this, args);
    store.getItem(date).then((res: [] = []) => {
      if (res) {
        arr = [...res].slice(-200);
      }
      const resData = addTimerData(args);
      arr.push(resData);
      store.setItem(date, arr);
    });
  };
  const oldWarn = console.warn;
  console.warn = (...args) => {
    oldWarn.apply(this, args);
    let arr = [];
    store.getItem(date).then((res: [] = []) => {
      if (res) {
        arr = [...res].slice(-200);
      }
      const resData = addTimerData(args);
      arr.push(resData);
      store.setItem(date, arr);
    });
  };
};

export default init;
