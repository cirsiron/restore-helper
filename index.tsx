import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, Animated, TouchableOpacity } from 'react-native';
import GestureFn, { getToday, panResponderHandler, changeVisibility } from './utils';
import storage from './storage';
import init from './decorate';
import share from './share';

init();
const date = getToday();

const TestHelper = ({ onHide }) => {
  const [store, setStore] = useState([]);
  const [isShow, setIsShow] = useState(false);
  const butRef = useRef(null);
  const posRef = useRef({ x: 20, y: 10 });

  const handleFetch = () => {
    storage.getItem(date).then(res => {
      setStore(res || []);
    });
  };
  useEffect(() => {
    handleFetch();
  }, []);

  const handlePress = () => {
    !isShow && handleFetch();
    setIsShow(false);
  };
  const handleClear = () => {
    storage.clear();
    handleFetch();
  };
  const handleHide = () => {
    onHide && onHide();
  };
  const handleChangeTool = () => {
    !isShow && handleFetch();
    setIsShow(!isShow);
  };
  const handleShare = () => {
    share(JSON.stringify(store, null, 2));
  }
  if (!isShow) {
    const handler = panResponderHandler({
      onPanResponderMove: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        const px = -dx + posRef.current.x;
        const py = -dy + posRef.current.y;
        butRef.current?.setNativeProps({
          right: px,
          bottom: py,
        });
      },
      onPanResponderRelease: (e, gestureState) => {
        const { dx, dy } = gestureState;
        const px = -dx + posRef.current.x;
        posRef.current.x = px;
        const py = -dy + posRef.current.y;
        posRef.current.y = py;
        console.log(px, py, 'pxpxpxpx');
      },
    });
    return (
      <Animated.View
        ref={r => (butRef.current = r)}
        style={[
          styles.buttonWrapper,
          {
            right: posRef.current.x,
            bottom: posRef.current.y,
          },
        ]}
      >
        <View {...handler.panHandlers}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.buttonStyle}
            onPress={handleChangeTool}
          >
            <Text
              style={{
                color: 'white',
              }}
            >
              Restore
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }
  return (
    <View
      style={[
        styles.helperContainer,
        {
          height: '80%',
          backgroundColor: '#eee',
        },
      ]}
    >
      <ScrollView>
        {store.map((i, idx) => {
          return (
            <View
              // eslint-disable-next-line react/no-array-index-key
              key={idx}
              style={{
                width: '100%',
              }}
            >
              <Text style={{ color: '#333' }}>{JSON.stringify(i, null, 2).slice(0, 200)}</Text>
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.buttonWrapper}>
        <TouchableOpacity style={styles.buttonStyle} onPress={handlePress}>
          <Text style={{ color: 'white' }}>最小化</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonStyle} onPress={handleHide}>
          <Text style={{ color: 'white' }}>隐藏</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonStyle} onPress={handleShare}>
          <Text style={{ color: 'white' }}>分享</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonStyle} onPress={handleClear}>
          <Text style={{ color: 'white' }}>清空</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  helperContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    zIndex: 99999,
    paddingBottom: 40,
  },
  buttonWrapper: {
    position: 'absolute',
    bottom: 10,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonStyle: {
    height: 40,
    width: 80,
    color: 'white',
    backgroundColor: '#333',
    marginHorizontal: 4,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export const utils = {
  gestureFn: GestureFn,
  changeVisibility,
};

export const restore = {
  run: init,
};

export default TestHelper;
