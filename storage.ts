import { AsyncStorage } from 'react-native';

const storage = {
  async getItem(key: string, prefix = '') {
    return new Promise((resolve, reject) => {
      const id = `${prefix}`.slice(0, 8);
      AsyncStorage.getItem(`${key}_${id}`, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        if (data) {
          resolve(JSON.parse(data).value);
        }
        resolve(null);
      });
    });
  },
  async setItem(key: string, value: any, prefix = '') {
    const id = `${prefix}`.slice(0, 8);
    const data = { value, type: typeof value };
    const jsonValue = JSON.stringify(data);
    return new Promise((resolve, reject) => {
      AsyncStorage.setItem(`${key}_${id}`, jsonValue, err => {
        if (err) {
          reject(err);
          return;
        }
        resolve(true);
      });
    });
  },
  async removeItem(key: string, prefix = "") {
    const id = `${prefix}`.slice(0, 8);
    return new Promise((resolve, reject) => {
      AsyncStorage.removeItem(`${key}_${id}`, err => {
        if (err) {
          reject(err);
          return;
        }
        resolve(true);
      });
    });
  },
  clear() {
    AsyncStorage.clear();
  },
};

export default storage;
