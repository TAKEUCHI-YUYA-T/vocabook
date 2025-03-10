import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, Animated, Dimensions, Image, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { fetchSpreadsheetData } from "../utils/fetchSpreadsheetData";

export default function App() {
  const router = useRouter();
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const [poops, setPoops] = useState<{ id: number; x: number; anim: Animated.Value }[]>([]);

  const { width, height } = Dimensions.get("window");

  useEffect(() => {
    const getData = async () => {
      setLoading(true);
      const sheetNames = ["reference"];
      const response = await fetchSpreadsheetData(sheetNames);

      if (Array.isArray(response) && response.length > 0) {
        const referenceData = response.find(sheet => sheet.sheetType === "reference")?.data ?? [];

        if (Array.isArray(referenceData) && referenceData.length > 1) {
          const filteredData = referenceData.slice(1).filter(row => row.length > 0 && row[0]?.trim() !== "");
          const shuffledData = shuffleArray(filteredData);
          setRows(shuffledData.slice(0, 1));
        } else {
          console.warn("取得したデータが空、または無効です。");
        }
      } else {
        console.warn("API のレスポンスが無効です。");
      }

      setLoading(false);
    };

    getData();
  }, []);

  const shuffleArray = (array: string[][]) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  const dropPoop = () => {
    const id = Date.now();
    const x = Math.random() * (width - 50);
    const anim = new Animated.Value(0);

    setPoops(prev => [...prev, { id, x, anim }]);

    Animated.timing(anim, {
      toValue: height,
      duration: 2000,
      useNativeDriver: true,
    }).start(() => {
      setPoops(prev => prev.filter(poop => poop.id !== id));
    });
  };

  return (
    <View style={styles.container}>
      <Image source={require("../assets/images/logo.png")} style={styles.logo} />

      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.innerContainer}>
          {loading ? (
            <Text style={styles.cellData}>読み込み中...</Text>
          ) : rows.length > 0 ? (
            rows.map((row, index) => (
              <View key={index} style={styles.wordContainer}>
                <Text style={styles.cellDataBold}>{row[0]}</Text>
                {row[1] && <Text style={styles.cellData}>{row[1]}</Text>}
                {row[2] && (
                  <TouchableOpacity onPress={() => Linking.openURL(row[2])}>
                    <Text style={styles.linkText}>外部リンク</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.cellData}>データなし</Text>
          )}

          <TouchableOpacity style={styles.button} onPress={() => router.push("/selectSheetScreen")}>
            <Text style={styles.buttonText}>単語を覚える</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => router.push("/ingOrTo")}>
            <Text style={styles.buttonText}>ing or to</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={dropPoop}>
            <Text style={styles.buttonText}>うんち💩</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {poops.map(poop => (
        <Animated.Text
          key={poop.id}
          style={[styles.poop, { left: poop.x, transform: [{ translateY: poop.anim }] }]}
        >
          💩
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fffeef",
  },
  scrollContainer: {
    flexGrow: 1, // コンテンツが少ない場合でも中央に配置
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },
  innerContainer: {
    width: "100%",
    alignItems: "center",
  },
  logo: {
    width: 180,
    height: 80,
    marginBottom: 20,
    marginTop: 70,
    alignSelf: "center",
  },
  wordContainer: {
    width: "80%",
    alignItems: "flex-start",
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  cellData: {
    fontSize: 18,
    color: "black",
    marginBottom: 10,
    textAlign: "left",
    width: "80%",
  },
  cellDataBold: {
    fontSize: 18,
    color: "black",
    fontWeight: "bold",
    marginBottom: 5,
  },
  linkText: {
    fontSize: 18,
    color: "blue",
    textDecorationLine: "underline",
    width: "auto",
    alignSelf: "flex-start",
  },
  button: {
    backgroundColor: "#9fd700",
    padding: 15,
    borderRadius: 10,
    marginVertical: 5,
    width: "80%",
    alignItems: "center",
  },
  buttonText: {
    color: "#446158",
    fontSize: 18,
    fontWeight: "bold",
  },
  poop: {
    position: "absolute",
    fontSize: 30,
  },
});
