/* eslint-disable react/sort-comp */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-case-declarations */
import _ from 'lodash';
import { Store } from 'redux';
import React, { Component } from 'react';
import { Provider, connect } from 'react-redux';
import { TYSdk, Theme, DevInfo, GlobalTheme, Utils } from 'tuya-panel-kit';
import { getOssUrl, sliceLights } from '@api';
import { NativeModules, NativeEventEmitter, StatusBar, View, AppState } from 'react-native';
import dragon from '@tuya-rn/tuya-native-dragon';
import { withConfig, Config } from '@tuya-rn/tuya-native-standard-hoc';
import SupportUtils from '@tuya-rn/tuya-native-lamp-elements/lib/utils/support';
import { Connect } from '@components';
import { actions, ReduxState } from '@models';
import * as TaskManager from '@utils/taskManager';
import LampApi from '@tuya-rn/tuya-native-lamp-elements/lib/api/index';
import { dragonConfig, registerTheme } from '@config';
import dpCodes from '@config/default/dpCodes';
import defaultLocalMusic from '@config/default/localMusic';
import * as MusicManager from '@utils/music';
import { getBarMode, getCorrectWorkMode, isSupportLocalTimer, getDpDataFromDevice } from '@utils';
import ErrorBoundary from '@utils/errorCatch';
import RestoreHelper, { utils, restore } from '@components/RestoreHelper';

import defaultUiConfig from './config/panelConfig/iot';

interface Props {
  devInfo: DevInfo;
  preload?: boolean;
}

interface States {
  showPage: boolean;
}
interface ConnectedProps extends ReduxState {
  mapStateToProps: any;
}
// 运行监测
restore.run();

const TYEvent = TYSdk.event;
const TYDevice = TYSdk.device;
const {
  countdownCode,
  powerCode,
  ledNumberCode,
  workModeCode,
  drawToolCode,
  sceneCode,
  rgbMusicCode,
  colourCode,
  rtcTimeCode,
} = dpCodes;
const {
  common: {
    asyncResponseUpdateDp,
    responseUpdateDp,
    deviceChange,
    devInfoChange,
    updatePanelState,
  },
} = actions;
let hasCloudFinish = false;

// 互斥任务管理
export const updateTaskData = (dpState: any) => {
  const { TaskType } = TaskManager;
  // 倒计时
  if (typeof dpState[countdownCode] !== 'undefined') {
    TaskManager.remove(TaskType.COUNTDOWN);
    if (dpState[countdownCode] > 0) {
      TaskManager.add(dpState[countdownCode], TaskType.COUNTDOWN, 'second');
    }
  }

  // 本地定时
  if (
    typeof dpState[rtcTimeCode] !== 'undefined' &&
    !SupportUtils.isGroupDevice() &&
    hasCloudFinish
  ) {
    const rtcTimerData: any = dpState[rtcTimeCode];
    const rtcTimerDataArr = [rtcTimerData];
    const { timerId, repeat, startTime, type, status } = rtcTimerData;

    const filterArr = TaskManager.tasks.filter(aItem =>
      rtcTimerDataArr.some(bItem => aItem.id === bItem.timerId)
    );

    if (filterArr.length) {
      TaskManager.remove(TaskType.LOCAL_TIMING, timerId);
      if (type && status) {
        TaskManager.add(
          {
            id: timerId,
            weeks: repeat && repeat.split('').map(i => +i),
            startTime,
            endTime: startTime,
          },
          TaskType.LOCAL_TIMING
        );
      }
    } else if (repeat) {
      // 添加
      const data = {
        id: timerId,
        weeks: repeat && repeat.split('').map((i: string | number) => +i),
        startTime,
        endTime: startTime,
      };
      TaskManager.add(data, TaskType.LOCAL_TIMING);
    }
  }
};

// signmesh倒计时处理
let countdownTimer = 0;
export const countdownDo = (countdown: number, dispatch) => {
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    // eslint-disable-next-line no-param-reassign
    countdown--;
    dispatch(responseUpdateDp({ [countdownCode]: Math.max(countdown, 0) }));
    if (countdown <= 0) clearInterval(countdownTimer);
  }, 1000);
};

/** 进入面板时更新redux */
const initStates = async (store: Store, data: any) => {
  const { dispatch } = store;
  const workMode = data.state[workModeCode];
  const barMode = getBarMode(workMode);
  const realBarMode = ['light', 'scene', 'more'].find(i => barMode === i) || 'light';
  dispatch(
    updatePanelState({
      barMode: realBarMode,
      lightMode: workMode === 'white' ? 'white' : 'colour',
    })
  );
  // await dispatch(getCloudState(true));
};

const composeLayout = (store: Store, Comp: React.ComponentType<any>) => {
  // const NavigatorLayout = component;
  const { dispatch } = store;

  const ThemeContainer = connect((props: { theme: GlobalTheme }) => ({ theme: props.theme }))(
    Theme
  );

  const onInit = (devInfo: DevInfo) => {
    try {
      getOssUrl().then(staticPrefix => dispatch(actions.common.initStaticPrefix(staticPrefix)));
      dispatch(actions.common.updateMiscConfig({ hasSwitch: !!devInfo.schema.switch }));
    } catch (error) {
      console.warn('onApplyConfig Failed :>> ', error);
    }
  };

  const onApplyConfig = (config: Config, devInfo: DevInfo, source: string) => {
    try {
      const showSchedule = !!config?.cloudFun?.timer?.selected;
      dispatch(actions.common.initIoTConfig(config.iot));
      dispatch(actions.common.initBicConfig(config.cloudFun));
      const { timestamp, ...dpFun } = config.dpFun || {};
      const funConfig = _.mapValues(dpFun, value => parseJSON(value));
      dispatch(actions.common.initFunConfig({ ...funConfig, raw: config.dpFun }));
      dispatch(actions.common.updateMiscConfig({ ...config.misc, showSchedule }));
      dispatch(actions.common.initializedConfig());
      updateTheme(config.iot);
    } catch (error) {
      console.warn('onApplyConfig Failed :>> ', error);
    }
  };

  const updateTheme = (data: any) => {
    // 根据获取到到iot配置生成面板主题配置
    const theme = registerTheme(data) as any;
    const isDefaultTheme = data.theme === 'default' || data.theme === 'dark';
    StatusBar.setBarStyle(isDefaultTheme ? 'light-content' : 'default');
    if (theme) {
      dispatch(actions.theme.updateTheme(theme));
    }
  };

  const NavigatorLayout: React.FC<Props> = p => {
    const [showHelp, setShowHelp] = React.useState(false);
    React.useEffect(() => {
      const { TYRCTIoTCardManager } = NativeModules;
      if (TYRCTIoTCardManager && typeof TYRCTIoTCardManager.ioTcardRechargeHander === 'function') {
        TYRCTIoTCardManager.ioTcardRechargeHander(p.devInfo.devId, () => {
          console.log('ioTcardRechargeHander callback');
        });
      }
    }, []);
    const handleHide = () => {
      setShowHelp(false);
    };
    return (
      <Connect mapStateToProps={_.identity}>
        {({ mapStateToProps, ...props }: ConnectedProps) => {
          const { panelConfig, dpState } = props;
          if (Object.keys(props.devInfo.schema).length === 0) {
            console.warn(
              '当前设备不存在功能点，模板会白屏状态，如为正常需求，请自行删除此处判断逻辑'
            );
          }
          const hasInit = Object.keys(dpState).length > 0 && panelConfig.initialized;
          // eslint-disable-next-line react/jsx-props-no-spreading
          return hasInit ? (
            <View
              {...utils.changeVisibility(setShowHelp).panHandlers}
              style={{
                height: '100%',
                width: '100%',
              }}
            >
              <Comp {...props} />
              {showHelp && <RestoreHelper onHide={handleHide} />}
            </View>
          ) : null;
        }}
      </Connect>
    );
  };

  const NavigatorLayoutContainer = withConfig({
    onInit,
    onApplyConfig,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    defaultUiConfig,
  })(NavigatorLayout);

  // 获取色值 Json
  const readThemeJson = () => {
    NativeModules.TYRCTThemeManager.readThemeData(
      (success: { [key1: string]: { [key2: string]: string } }) =>
        dispatch(actions.common.updateAppTheme(success)),
      (error: string) => console.warn('appThemeConfiguration.init', error)
    );
  };
  TYEvent.on('deviceDataChange', data => {
    switch (data.type) {
      case 'dpData':
        dragon.receiveDp(data.payload as any);
        break;
      default:
        dispatch(deviceChange(data.payload as DevInfo));
        break;
    }
  });

  if (NativeModules.TYRCTThemeManager) {
    const eventEmitter = new NativeEventEmitter(NativeModules.TYRCTThemeManager);
    eventEmitter.addListener('themeChanged', () => {
      readThemeJson();
    });
  }

  TYSdk.event.on('networkStateChange', data => {
    dispatch(deviceChange(data as any));
  });

  class PanelComponent extends Component<Props, States> {
    appShow: boolean;
    constructor(props: Props) {
      super(props);
      this.appShow = true;
      this.state = {
        showPage: false,
      };
      if (props && props.devInfo && props.devInfo.devId) {
        TYDevice.setDeviceInfo(props.devInfo);
        TYDevice.getDeviceInfo().then(data => {
          dispatch(devInfoChange(data));
          TYDevice.getDeviceState();
          this.initData(data);
          return initStates(store, data);
        });
      } else if (!props.preload) {
        TYDevice.getDeviceInfo()
          .then(data => {
            dispatch(devInfoChange(data));
            this.initData(data);
            return initStates(store, data);
          })
          .catch((e: Error) => {
            console.warn(e);
          });
      }
      this.subscribe();
    }

    componentDidMount() {
      if (TYSdk.__unInitializeDps) {
        dragon.receiveDp(TYSdk.__unInitializeDps);
      }
      getDpDataFromDevice(ledNumberCode);
      setTimeout(() => {
        getDpDataFromDevice(drawToolCode);
      }, 200);
      setTimeout(() => {
        getDpDataFromDevice(sceneCode);
      }, 400);
      this.listenerAppState();
    }

    componentWillUnmount() {
      this.unsubscribe();
      AppState.removeEventListener('change', this._handleAppState);
    }
    _handleAppState = nextAppState => {
      if (nextAppState != null && nextAppState === 'active') {
        // 如果是true ，表示从后台进入了前台 ，请求数据，刷新页面。或者做其他的逻辑
        if (this.appShow) {
          // 这里的逻辑表示 ，第一次进入前台的时候 ，不会进入这个判断语句中。
          // 因为初始化的时候是false ，当进入后台的时候 ，flag才是true ，
          // 当第二次进入前台的时候 ，这里就是true ，就走进来了。
          // 从后台进入前台时需要刷新 倒计时
          if (SupportUtils.isSignMeshDivice()) {
            TYDevice.getDpDataFromDevice(countdownCode);
          }
        }
        this.appShow = false;
      } else if (nextAppState != null && nextAppState === 'background') {
        this.appShow = true;
        // console.log('从前台进入后台');
      }
    };
    listenerAppState = () => {
      AppState.addEventListener('change', this._handleAppState);
    };
    async initData(devInfo: DevInfo) {
      // 注册dragon库
      this.initDragon(devInfo);
      // 获取本地数据
      const localData = await LampApi.fetchLocalConfig!();

      if (localData) {
        this.handleCloudData(localData);
        // 同步数据
        LampApi.syncCloudConfig!();
      } else {
        // todo show loading
        // 加载云端数据
        LampApi.fetchCloudConfig!().then(cloudData => {
          this.handleCloudData(cloudData);
        });
      }
      this.setState({ showPage: true });
    }

    /** 更新redux中依赖dpState的其他state */
    responseUpdateOtherStates = (data: any) => {
      const updates: any = {};
      const workMode = data[workModeCode];
      const {
        panelState: { barMode },
      } = store.getState();

      if (workMode !== undefined) {
        // 根据workMode更新barMode(只有当前处于workMode页面，才会去更新barMode)
        if (['light', 'scene', 'more'].includes(barMode)) updates.barMode = getBarMode(workMode);
        // 根据workMode更新lightMode
        if (['colour', 'white'].includes(workMode)) updates.lightMode = workMode;
      }
      dispatch(updatePanelState(updates));
    };

    handleUpdateDp = (d: any) => {
      // 屏蔽白光、彩光的dp上报，完全交由涂抹dp来处理（解决调光页抖动）
      delete d[colourCode];
      // delete d[brightCode];
      // delete d[temperatureCode];
      // 特殊处理，daubType为0时不处理，设备重启后不会上报颜色
      if (!d[drawToolCode]?.daubType && !SupportUtils.isGroupDevice()) delete d[drawToolCode];
      const workMode = d[workModeCode];
      // 校正workMode
      if (workMode !== undefined) {
        const correctWorkMode = getCorrectWorkMode(workMode);
        if (workMode !== correctWorkMode) {
          // delete d[workModeCode];
          dragon.putDpData({ [workModeCode]: correctWorkMode });
        }
      }
      if (d[rgbMusicCode]) {
        // 当设备主动上报更改本地音乐灵敏度后(如遥控器控制)，面板更新数据
        const { id, sensitivity } = d[rgbMusicCode] as RgbMusicValue;
        const storeState = store.getState() as ReduxState;
        const currLocalMusicData = _.find(storeState.cloudState.localMusicList, { id });
        if (currLocalMusicData && currLocalMusicData.sensitivity !== sensitivity) {
          currLocalMusicData!.sensitivity = sensitivity;
          this.updateLocalMusicData(currLocalMusicData!);
        }
      }
      // 关灯 / 本地音乐开启 关闭app音乐
      if (
        (typeof d[powerCode] !== 'undefined' && !d[powerCode]) ||
        (!!d[rgbMusicCode] && !!(d[rgbMusicCode] as RgbMusicValue).power)
      ) {
        MusicManager.close();
      }

      if (!Object.keys(d).length) return;

      // 是否有开关动作，如果有开关动作，则将倒计时清 0
      if (typeof d[powerCode] !== 'undefined') {
        countdownDo(0, dispatch);
      }
      // 倒计时操作
      if (typeof d[countdownCode] !== 'undefined') {
        countdownDo(d[countdownCode], dispatch);
      }
      dispatch(asyncResponseUpdateDp(d));
      this.responseUpdateOtherStates(d);
      // 互斥管理数据
      updateTaskData(d);
    };

    handleCloudData(cloudData: any) {
      // const scenes: SceneData[] = [];
      const localMusicList: RgbMusicValue[] = _.cloneDeep(defaultLocalMusic);
      let collectedSceneIds: number[] = [];
      let lights: string[] = [];
      let loaded = 0;
      // 不是群组在这里做本地定时处理
      const rtcTimers: [] = [];
      const cloudDataMap = {};

      const isSingle = !SupportUtils.isGroupDevice();
      Object.entries(cloudData).forEach(([code, value]: [string, any]) => {
        // 本地音乐
        if (/^local_music_\d+$/.test(code) && value) {
          const id = +code.substr(12);
          for (let i = 0; i < localMusicList.length; i++) {
            if (localMusicList[i].id === id && value) {
              localMusicList[i] = value;
            }
          }
        }
        // 收藏的情景key
        if (/^collectedSceneIds$/.test(code) && value) {
          collectedSceneIds = value;
        }
        // lights
        if (/^lights_0$/.test(code) && value) {
          lights = sliceLights(value);
        }
        // loaded
        if (/^loaded$/.test(code) && value) {
          loaded = 1;
        }
        if (isSingle && isSupportLocalTimer()) {
          // 是否为本地定时数据
          const codeIndex = code.split('_')[1] || 1;
          if (/^timer_\d+$/.test(code) && value) {
            const data = Utils.JsonUtils.parseJSON(value);
            if (data) {
              const timerData = { ...data, timerId: Number(codeIndex) };
              rtcTimers.push(timerData);
            }
          }

          rtcTimers.sort((a: any, b: any) => a.timerId - b.timerId);
          rtcTimers.forEach((item: any) => {
            const taskData = {
              id: item.timerId,
              weeks: item.repeat && item.repeat.split('').map(i => +i),
              startTime: item.startTime,
              endTime: item.startTime,
            };
            item.status && TaskManager.add(taskData, TaskManager.TaskType.LOCAL_TIMING);
          });

          hasCloudFinish = true;
        }
        cloudDataMap[code] = value;
      });
      dispatch(
        actions.cloudState.initCloud({
          localMusicList,
          collectedSceneIds,
          lights,
          loaded,
          ...cloudDataMap,
          rtcTimers,
        })
      );
      dispatch(asyncResponseUpdateDp(store.getState().dpState));
    }

    updateLocalMusicData = _.throttle((data: RgbMusicValue) => {
      const { id } = data;
      dispatch(actions.cloudState.updateLocalMusic(data));
      LampApi.saveCloudConfig!(`local_music_${id}`, data);
    }, 500);

    // 初始化dragon
    initDragon(devInfo: DevInfo) {
      // 设置配置
      dragon.config({ ...dragonConfig, schema: TYSdk.device.getDpSchema() } as any);
      // 加入监听数据变化事件
      dragon.onDpChange(this.handleUpdateDp);
      // 初始化dp数据，此操作会触发 onDpChange 事件
      dragon.initDp(devInfo.state);
    }

    subscribe() {
      // 同步数据事件
      TYEvent.on('beginSyncCloudData', this._handleBeginSyncCloudData);
      TYEvent.on('endSyncCloudData', this._handleEndSyncCloudData);
      TYEvent.on('syncCloudDataError', this._handleErrorSyncCloudData);
    }

    unsubscribe() {
      TYEvent.remove('beginSyncCloudData', this._handleBeginSyncCloudData);
      TYEvent.remove('endSyncCloudData', this._handleEndSyncCloudData);
      TYEvent.remove('syncCloudDataError', this._handleErrorSyncCloudData);
    }

    _handleBeginSyncCloudData = (data: any) => {
      console.log('开始同步数据');
    };

    _handleEndSyncCloudData = (data: any) => {
      console.log('结束同步数据');
      this.handleCloudData(data);
    };

    _handleErrorSyncCloudData = (data: any) => {
      console.log('同步失败数据');
    };
    render() {
      const { devInfo } = this.props;
      const { showPage } = this.state;
      if (!showPage) return <View />;
      return (
        // <ErrorBoundary>
        <Provider store={store}>
          <ThemeContainer>
            <NavigatorLayoutContainer devInfo={devInfo} />
          </ThemeContainer>
        </Provider>
        // </ErrorBoundary>
      );
    }
  }

  return PanelComponent;
};

export default composeLayout;
