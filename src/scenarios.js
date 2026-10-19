// Definición de escenarios de laboratorio con fallas reales para resolución de problemas
export const SCENARIOS = [
  {
    id: "vlan-basic-01",
    title: "1. Asignación de VLANs y Puertos de Acceso",
    category: "VLAN & Enlaces de Acceso",
    difficulty: "Principiante",
    description: "En el departamento de Finanzas y Ventas, los usuarios de la VLAN 10 (Finanzas) en FastEthernet 0/1 no logran comunicarse con la VLAN 20 (Ventas) en FastEthernet 0/2. Actualmente los puertos están en la VLAN 1 por defecto y la VLAN 10/20 ni siquiera existen.",
    objectives: [
      "Crear VLAN 10 con nombre 'Finanzas'",
      "Crear VLAN 20 con nombre 'Ventas'",
      "Configurar FastEthernet0/1 en modo access y asignarlo a VLAN 10",
      "Configurar FastEthernet0/2 en modo access y asignarlo a VLAN 20",
      "Verificar con 'show vlan brief' e 'show interfaces status'"
    ],
    hints: [
      "Entra en modo configuración: 'configure terminal'",
      "Crea la VLAN: 'vlan 10', luego 'name Finanzas'",
      "Para interfaces: 'interface fa0/1' -> 'switchport mode access' -> 'switchport access vlan 10'"
    ],
    initialConfig: {
      hostname: "Switch-Acceso-1",
      vlans: {
        "1": { name: "default", ports: ["Fa0/1", "Fa0/2", "Fa0/3", "Fa0/4", "Gi0/1", "Gi0/2"] }
      },
      interfaces: {
        "Fa0/1": { mode: "access", vlan: 1, status: "up", duplex: "auto", speed: "auto", description: "PC-Finanzas-1" },
        "Fa0/2": { mode: "access", vlan: 1, status: "up", duplex: "auto", speed: "auto", description: "PC-Ventas-1" },
        "Fa0/3": { mode: "access", vlan: 1, status: "up", duplex: "auto", speed: "auto" },
        "Fa0/4": { mode: "access", vlan: 1, status: "down", duplex: "auto", speed: "auto" },
        "Gi0/1": { mode: "access", vlan: 1, status: "up", duplex: "auto", speed: "auto" },
        "Gi0/2": { mode: "access", vlan: 1, status: "up", duplex: "auto", speed: "auto" }
      },
      svi: {},
      spanningTree: { mode: "pvst", priority: 32768 }
    },
    validate: (state) => {
      const vlan10 = state.vlans["10"] && state.vlans["10"].name.toLowerCase() === "finanzas";
      const vlan20 = state.vlans["20"] && state.vlans["20"].name.toLowerCase() === "ventas";
      const p1 = state.interfaces["Fa0/1"] && state.interfaces["Fa0/1"].vlan === 10 && state.interfaces["Fa0/1"].mode === "access";
      const p2 = state.interfaces["Fa0/2"] && state.interfaces["Fa0/2"].vlan === 20 && state.interfaces["Fa0/2"].mode === "access";

      const checks = [
        { label: "VLAN 10 'Finanzas' creada", passed: !!vlan10 },
        { label: "VLAN 20 'Ventas' creada", passed: !!vlan20 },
        { label: "Fa0/1 configurada como switchport access vlan 10", passed: !!p1 },
        { label: "Fa0/2 configurada como switchport access vlan 20", passed: !!p2 }
      ];
      return {
        completed: checks.every(c => c.passed),
        checks
      };
    }
  },
  {
    id: "trunk-port-range-02",
    title: "2. Enlace Troncal 802.1Q y Rangos de Puertos",
    category: "Enlaces Troncales & Rango de Puertos",
    difficulty: "Intermedio",
    description: "Existe una desconexión entre el Switch de Acceso y el Switch de Distribución. El puerto GigabitEthernet 0/1 está configurado erróneamente en modo acceso, bloqueando el tráfico etiquetado de las VLANs 10, 20 y 30. Además, debes asegurar en bloque los puertos sobrantes Fa0/10 a Fa0/24 asignándolos a la VLAN 99 (Cuarentena/Blackhole) y apagándolos.",
    objectives: [
      "Configurar Gi0/1 como trunk 802.1Q permitiendo VLANs 10,20,30",
      "Definir la VLAN nativa 99 en el troncal Gi0/1",
      "Crear VLAN 99 'Cuarentena'",
      "Usar 'interface range fa0/10 - 24' para ponerlos en VLAN 99 y aplicar 'shutdown'",
      "Verificar con 'show interfaces trunk' y 'show interfaces status'"
    ],
    hints: [
      "En Gi0/1: 'switchport mode trunk', 'switchport trunk allowed vlan 10,20,30,99', 'switchport trunk native vlan 99'",
      "Rango: 'interface range fa0/10 - 24' -> 'switchport access vlan 99' -> 'shutdown'"
    ],
    initialConfig: {
      hostname: "SW-Distribucion-Edge",
      vlans: {
        "1": { name: "default", ports: [] },
        "10": { name: "Finanzas", ports: ["Fa0/1"] },
        "20": { name: "Ventas", ports: ["Fa0/2"] },
        "30": { name: "Ingenieria", ports: ["Fa0/3"] }
      },
      interfaces: {
        "Fa0/1": { mode: "access", vlan: 10, status: "up" },
        "Fa0/2": { mode: "access", vlan: 20, status: "up" },
        "Fa0/3": { mode: "access", vlan: 30, status: "up" },
        "Fa0/10": { mode: "access", vlan: 1, status: "up" },
        "Fa0/11": { mode: "access", vlan: 1, status: "up" },
        "Fa0/12": { mode: "access", vlan: 1, status: "up" },
        "Fa0/13": { mode: "access", vlan: 1, status: "up" },
        "Fa0/14": { mode: "access", vlan: 1, status: "up" },
        "Fa0/15": { mode: "access", vlan: 1, status: "up" },
        "Gi0/1": { mode: "access", vlan: 1, status: "up", description: "Uplink-Core-Switch" },
        "Gi0/2": { mode: "access", vlan: 1, status: "down" }
      },
      svi: {},
      spanningTree: { mode: "pvst", priority: 32768 }
    },
    validate: (state) => {
      const vlan99 = !!state.vlans["99"];
      const gi1 = state.interfaces["Gi0/1"];
      const isTrunk = gi1 && gi1.mode === "trunk";
      const nativeOk = gi1 && gi1.nativeVlan === 99;
      const allowedOk = gi1 && gi1.allowedVlans && (gi1.allowedVlans.includes(10) && gi1.allowedVlans.includes(20) && gi1.allowedVlans.includes(30));
      
      let rangeOk = true;
      for (let i = 10; i <= 15; i++) {
        const port = state.interfaces[`Fa0/${i}`];
        if (!port || port.vlan !== 99 || port.status !== "administratively down") {
          rangeOk = false;
          break;
        }
      }

      const checks = [
        { label: "VLAN 99 creada", passed: vlan99 },
        { label: "Gi0/1 configurado en modo TRUNK", passed: isTrunk },
        { label: "VLAN Nativa 99 configurada en Gi0/1", passed: nativeOk },
        { label: "VLANs 10,20,30 permitidas en troncal", passed: allowedOk },
        { label: "Rango Fa0/10-24 asignado a VLAN 99 y con shutdown", passed: rangeOk }
      ];
      return {
        completed: checks.every(c => c.passed),
        checks
      };
    }
  },
  {
    id: "intervlan-svi-ipv4-ipv6-03",
    title: "3. Inter-VLAN Routing con Switch L3 & IPv4 / IPv6",
    category: "Inter VLAN Routing & Dual Stack",
    difficulty: "Avanzado",
    description: "Este Switch Multicapa (L3) debe enrutar entre las VLANs 10 (Servidores) y VLAN 20 (Usuarios), además de tener conectividad de gestión dual-stack IPv4 e IPv6. La conectividad falla porque el enrutamiento IP ('ip routing' e 'ipv6 unicast-routing') no está habilitado, y las interfaces virtuales SVI (Interface VLAN) no tienen configurada su IP o están apagadas.",
    objectives: [
      "Habilitar enrutamiento L3 con 'ip routing' e 'ipv6 unicast-routing'",
      "Configurar Interface Vlan 10 con IPv4 192.168.10.1/24 y habilitarla (no shutdown)",
      "Configurar Interface Vlan 10 con IPv6 2001:db8:acad:10::1/64",
      "Configurar Interface Vlan 20 con IPv4 192.168.20.1/24 e IPv6 2001:db8:acad:20::1/64",
      "Verificar la tabla con 'show ip route' e 'show ip interface brief'"
    ],
    hints: [
      "Global: 'ip routing' y 'ipv6 unicast-routing'",
      "SVI: 'interface vlan 10' -> 'ip address 192.168.10.1 255.255.255.0' -> 'ipv6 address 2001:db8:acad:10::1/64' -> 'no shutdown'",
      "Repetir para interface vlan 20 con 192.168.20.1 y 2001:db8:acad:20::1/64"
    ],
    initialConfig: {
      hostname: "Core-Switch-L3",
      ipRouting: false,
      ipv6Routing: false,
      vlans: {
        "1": { name: "default", ports: [] },
        "10": { name: "Servers", ports: ["Fa0/1", "Fa0/2"] },
        "20": { name: "Clients", ports: ["Fa0/3", "Fa0/4"] }
      },
      interfaces: {
        "Fa0/1": { mode: "access", vlan: 10, status: "up" },
        "Fa0/2": { mode: "access", vlan: 10, status: "up" },
        "Fa0/3": { mode: "access", vlan: 20, status: "up" },
        "Fa0/4": { mode: "access", vlan: 20, status: "up" },
        "Gi0/1": { mode: "trunk", allowedVlans: [10, 20], status: "up" }
      },
      svi: {
        "Vlan10": { ipv4: null, mask: null, ipv6: null, status: "administratively down" },
        "Vlan20": { ipv4: null, mask: null, ipv6: null, status: "administratively down" }
      },
      spanningTree: { mode: "pvst", priority: 24576 }
    },
    validate: (state) => {
      const ipR = !!state.ipRouting;
      const ipv6R = !!state.ipv6Routing;
      const v10 = state.svi["Vlan10"];
      const v20 = state.svi["Vlan20"];

      const v10Ipv4Ok = v10 && v10.ipv4 === "192.168.10.1" && v10.mask === "255.255.255.0" && v10.status === "up";
      const v10Ipv6Ok = v10 && v10.ipv6 && v10.ipv6.toLowerCase().includes("2001:db8:acad:10::1");
      const v20Ipv4Ok = v20 && v20.ipv4 === "192.168.20.1" && v20.mask === "255.255.255.0" && v20.status === "up";
      const v20Ipv6Ok = v20 && v20.ipv6 && v20.ipv6.toLowerCase().includes("2001:db8:acad:20::1");

      const checks = [
        { label: "IP Routing L3 habilitado ('ip routing')", passed: ipR },
        { label: "IPv6 Unicast Routing habilitado ('ipv6 unicast-routing')", passed: ipv6R },
        { label: "SVI Vlan 10 configurada 192.168.10.1/24 (no shutdown)", passed: !!v10Ipv4Ok },
        { label: "SVI Vlan 10 con IPv6 2001:db8:acad:10::1/64", passed: !!v10Ipv6Ok },
        { label: "SVI Vlan 20 configurada 192.168.20.1/24 (no shutdown)", passed: !!v20Ipv4Ok },
        { label: "SVI Vlan 20 con IPv6 2001:db8:acad:20::1/64", passed: !!v20Ipv6Ok }
      ];
      return {
        completed: checks.every(c => c.passed),
        checks
      };
    }
  },
  {
    id: "spanning-tree-root-04",
    title: "4. Spanning Tree Protocol (STP) - Optimización de Puente Raíz y Portfast",
    category: "Spanning Tree & Optimización",
    difficulty: "Avanzado",
    description: "En la red de campus, un switch de acceso de bajo rendimiento se ha elegido accidentalmente como Root Bridge debido a la prioridad STP por defecto (32768). Necesitamos que este Core Switch sea el Root Bridge Primario para las VLAN 10 y 20 (prioridad 4096 o 24576), y Root Secundario para VLAN 30. Adicionalmente, los puertos de usuario final Fa0/1 a Fa0/4 deben tener PortFast y BPDU Guard activados para evitar demoras al conectar PCs.",
    objectives: [
      "Configurar 'spanning-tree vlan 10,20 priority 4096' (o root primary)",
      "Configurar 'spanning-tree vlan 30 priority 28672' (o root secondary)",
      "Activar 'spanning-tree portfast' en Fa0/1 a Fa0/4",
      "Activar 'spanning-tree bpduguard enable' en Fa0/1 a Fa0/4",
      "Verificar con 'show spanning-tree' y 'show spanning-tree summary'"
    ],
    hints: [
      "Comandos globales STP: 'spanning-tree vlan 10,20 root primary' o 'spanning-tree vlan 10 priority 4096'",
      "Puertos de acceso: 'interface range fa0/1 - 4' -> 'spanning-tree portfast' -> 'spanning-tree bpduguard enable'"
    ],
    initialConfig: {
      hostname: "Core-STP-Root",
      vlans: {
        "1": { name: "default", ports: [] },
        "10": { name: "Finanzas", ports: ["Fa0/1", "Fa0/2"] },
        "20": { name: "Ventas", ports: ["Fa0/3", "Fa0/4"] },
        "30": { name: "Ingenieria", ports: [] }
      },
      interfaces: {
        "Fa0/1": { mode: "access", vlan: 10, status: "up", portfast: false, bpduguard: false },
        "Fa0/2": { mode: "access", vlan: 10, status: "up", portfast: false, bpduguard: false },
        "Fa0/3": { mode: "access", vlan: 20, status: "up", portfast: false, bpduguard: false },
        "Fa0/4": { mode: "access", vlan: 20, status: "up", portfast: false, bpduguard: false },
        "Gi0/1": { mode: "trunk", allowedVlans: [10, 20, 30], status: "up" },
        "Gi0/2": { mode: "trunk", allowedVlans: [10, 20, 30], status: "up" }
      },
      svi: {},
      stpVlanPriorities: {
        "10": 32768,
        "20": 32768,
        "30": 32768
      },
      spanningTree: { mode: "rapid-pvst", priority: 32768 }
    },
    validate: (state) => {
      const p10 = state.stpVlanPriorities && state.stpVlanPriorities["10"] <= 24576;
      const p20 = state.stpVlanPriorities && state.stpVlanPriorities["20"] <= 24576;
      const p30 = state.stpVlanPriorities && state.stpVlanPriorities["30"] === 28672;

      let portfastOk = true;
      let bpduOk = true;
      for (let i = 1; i <= 4; i++) {
        const p = state.interfaces[`Fa0/${i}`];
        if (!p || !p.portfast) portfastOk = false;
        if (!p || !p.bpduguard) bpduOk = false;
      }

      const checks = [
        { label: "VLAN 10 prioridad <= 24576 (Root Bridge Primario)", passed: !!p10 },
        { label: "VLAN 20 prioridad <= 24576 (Root Bridge Primario)", passed: !!p20 },
        { label: "VLAN 30 prioridad configurada en 28672 (Root Secundario)", passed: !!p30 },
        { label: "PortFast habilitado en interfaces de acceso (Fa0/1-4)", passed: portfastOk },
        { label: "BPDU Guard activado en interfaces de acceso (Fa0/1-4)", passed: bpduOk }
      ];
      return {
        completed: checks.every(c => c.passed),
        checks
      };
    }
  },
  {
    id: "troubleshoot-native-vlan-mismatch-05",
    title: "5. Troubleshooting: Desajuste de VLAN Nativa (Native VLAN Mismatch)",
    category: "Resolución de Problemas (Troubleshooting)",
    difficulty: "Intermedio",
    description: "Alerta en el Syslog: '%CDP-4-NATIVE_VLAN_MISMATCH: Native VLAN mismatch discovered on GigabitEthernet0/1 (99), with Switch-Remoto GigabitEthernet0/1 (1)'. Hay tormentas de broadcast y pérdida intermitente de paquetes entre switches. Debes diagnosticar la interfaz Gi0/1, corregir la VLAN nativa para que coincida con el switch vecino (VLAN 99) y restablecer la estabilidad del enlace.",
    objectives: [
      "Examinar el estado con 'show interfaces trunk' y 'show running-config'",
      "Configurar Gi0/1 con 'switchport trunk native vlan 99'",
      "Asegurar que VLAN 99 esté creada con el nombre 'Nativa-Admin'",
      "Comprobar con 'show interfaces trunk' que no haya desajuste"
    ],
    hints: [
      "Verifica: 'show interfaces trunk'",
      "Corrige: 'configure terminal' -> 'interface gi0/1' -> 'switchport trunk native vlan 99'",
      "Crea VLAN 99: 'vlan 99' -> 'name Nativa-Admin'"
    ],
    initialConfig: {
      hostname: "SW-Branch-Office",
      syslogErrors: [
        "%CDP-4-NATIVE_VLAN_MISMATCH: Native VLAN mismatch discovered on GigabitEthernet0/1 (1), with Switch-Core Gi0/1 (99)."
      ],
      vlans: {
        "1": { name: "default", ports: [] },
        "10": { name: "Operaciones", ports: ["Fa0/1", "Fa0/2"] }
      },
      interfaces: {
        "Fa0/1": { mode: "access", vlan: 10, status: "up" },
        "Fa0/2": { mode: "access", vlan: 10, status: "up" },
        "Gi0/1": { mode: "trunk", nativeVlan: 1, allowedVlans: [1, 10, 99], status: "up", description: "Uplink-to-Core-Switch" },
        "Gi0/2": { mode: "access", vlan: 1, status: "down" }
      },
      svi: {},
      spanningTree: { mode: "pvst", priority: 32768 }
    },
    validate: (state) => {
      const vlan99 = !!state.vlans["99"];
      const gi1 = state.interfaces["Gi0/1"];
      const nativeOk = gi1 && gi1.mode === "trunk" && gi1.nativeVlan === 99;

      const checks = [
        { label: "VLAN 99 'Nativa-Admin' creada en la base de datos", passed: vlan99 },
        { label: "Gi0/1 con switchport trunk native vlan 99 corregido", passed: !!nativeOk },
        { label: "Alerta de mismatch resuelta", passed: !!nativeOk && vlan99 }
      ];
      return {
        completed: checks.every(c => c.passed),
        checks
      };
    }
  }
];
