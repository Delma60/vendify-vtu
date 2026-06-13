import { View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#030712",
      }}
    >
      <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700" }}>
        VTU Mobile
      </Text>
      <Text style={{ color: "#cbd5e1", marginTop: 8 }}>
        Phase 0 mobile scaffold initialized.
      </Text>
    </View>
  );
}
