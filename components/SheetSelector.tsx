// components/SheetSelector.tsx
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

export type SheetSelectorProps = {
  selectedSheet: string;
  onSheetChange: (sheet: string) => void;
};

const sheetNames = ["all", "noun", "verb", "adverb", "adjective", "preposition", "conjunction", "auxiliaryVerb", "idiom"];

const SheetSelector = ({ selectedSheet, onSheetChange }: SheetSelectorProps) => {
  return (
    <View>
      <Text>シートを選択:</Text>
      {sheetNames.map((sheet) => (
        <TouchableOpacity key={sheet} onPress={() => onSheetChange(sheet)} style={{ padding: 10 }}>
          <Text style={{ color: sheet === selectedSheet ? "blue" : "black" }}>{sheet}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default SheetSelector;
