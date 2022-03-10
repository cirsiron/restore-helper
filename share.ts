import RNFetchBlob from '@tuya-rn/rn-fetch-blob';
import { NativeModules } from 'react-native';

const { TYRCTShareManager } = NativeModules;
/**
 *
 *
 * @param {string} type
 * @param {({
 *     title?: string;
 *     message?: string;
 *     imagePath?: string;
 *     filePath?: string;
 *     contentType: 'text' | 'image' | 'file';
 *   })} data
 * @return {*}
 */
const share = async (
  type: string,
  data: {
    title?: string;
    message?: string;
    imagePath?: string;
    filePath?: string;
    contentType: 'text' | 'image' | 'file';
  }
) => {
  if (TYRCTShareManager && TYRCTShareManager.share) {
    return TYRCTShareManager.share(type, data);
  }
  // eslint-disable-next-line prefer-promise-reject-errors
  return Promise.reject('not support share');
};
/**
 *
 * 导出text文件
 * @param {string} str 拼接需要导出的数据
 * @return {*}
 */
const exportText = async (str: string) => {
  // 保存文件
  const pathToWrite = `${RNFetchBlob.fs.dirs.CacheDir}/log_${+new Date()}.txt`;
  await RNFetchBlob.fs.writeFile(pathToWrite, str, 'utf8');
  return pathToWrite;
};
/**
 *
 * 分享文件
 * @param {*} str 拼接需要导出的数据
 */
const shareTextFile = async str => {
  const path = await exportText(str);
  try {
    await share('分享日志', {
      contentType: 'file',
      filePath: `file://${path}`,
    });
  } catch (er) {
    // 由于app本身无法准确判断分享是成功还是失败，所以此处不做提示处理
  }
};

export default shareTextFile;
