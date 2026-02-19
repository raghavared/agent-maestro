export interface TeamColor {
  id: string;
  primary: string;
  dim: string;
  border: string;
  text: string;
}

export const TEAM_COLORS: TeamColor[] = [
  { id: 'coral',    primary: '#ff7f50', dim: 'rgba(255, 127, 80, 0.08)',  border: 'rgba(255, 127, 80, 0.35)', text: '#ff9f7f' },
  { id: 'teal',     primary: '#00ced1', dim: 'rgba(0, 206, 209, 0.08)',   border: 'rgba(0, 206, 209, 0.35)', text: '#40e0d3' },
  { id: 'violet',   primary: '#8a2be2', dim: 'rgba(138, 43, 226, 0.08)',  border: 'rgba(138, 43, 226, 0.35)', text: '#b060f0' },
  { id: 'gold',     primary: '#ffd700', dim: 'rgba(255, 215, 0, 0.08)',   border: 'rgba(255, 215, 0, 0.35)', text: '#ffe040' },
  { id: 'lime',     primary: '#32cd32', dim: 'rgba(50, 205, 50, 0.08)',   border: 'rgba(50, 205, 50, 0.35)', text: '#60e060' },
  { id: 'hotpink',  primary: '#ff69b4', dim: 'rgba(255, 105, 180, 0.08)', border: 'rgba(255, 105, 180, 0.35)', text: '#ff8ec7' },
  { id: 'skyblue',  primary: '#1e90ff', dim: 'rgba(30, 144, 255, 0.08)',  border: 'rgba(30, 144, 255, 0.35)', text: '#50a8ff' },
  { id: 'orange',   primary: '#ffa500', dim: 'rgba(255, 165, 0, 0.08)',   border: 'rgba(255, 165, 0, 0.35)', text: '#ffbb40' },
];
