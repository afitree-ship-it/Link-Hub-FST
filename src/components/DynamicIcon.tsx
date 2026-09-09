import { 
  BookOpen, 
  Cpu, 
  Megaphone, 
  PhoneCall, 
  Link, 
  Globe, 
  Users, 
  GraduationCap, 
  Compass, 
  Calendar, 
  FileText, 
  ShieldAlert, 
  Settings, 
  HelpCircle,
  LucideProps
} from "lucide-react";
import React from "react";

interface DynamicIconProps extends Omit<LucideProps, "ref"> {
  name: string;
}

export const DynamicIcon: React.FC<DynamicIconProps> = ({ name, ...props }) => {
  switch (name) {
    case "BookOpen":
      return <BookOpen {...props} />;
    case "Cpu":
      return <Cpu {...props} />;
    case "Megaphone":
      return <Megaphone {...props} />;
    case "PhoneCall":
      return <PhoneCall {...props} />;
    case "Globe":
      return <Globe {...props} />;
    case "Users":
      return <Users {...props} />;
    case "GraduationCap":
      return <GraduationCap {...props} />;
    case "Compass":
      return <Compass {...props} />;
    case "Calendar":
      return <Calendar {...props} />;
    case "FileText":
      return <FileText {...props} />;
    case "ShieldAlert":
      return <ShieldAlert {...props} />;
    case "Settings":
      return <Settings {...props} />;
    case "HelpCircle":
      return <HelpCircle {...props} />;
    case "Link":
    default:
      return <Link {...props} />;
  }
};

// Available icons to select in Admin Form
export const AVAILABLE_ICONS = [
  { name: "BookOpen", label: "สมุด/การเรียน (BookOpen)" },
  { name: "Cpu", label: "คอมพิวเตอร์/ไอที (Cpu)" },
  { name: "Megaphone", label: "ประกาศ/ข่าวสาร (Megaphone)" },
  { name: "PhoneCall", label: "ติดต่อ/โทรศัพท์ (PhoneCall)" },
  { name: "Globe", label: "เว็บไซต์ทั่วไป (Globe)" },
  { name: "Users", label: "นักศึกษา/บริการทั่วไป (Users)" },
  { name: "GraduationCap", label: "วิชาการ/ทุนการศึกษา (GraduationCap)" },
  { name: "Compass", label: "ระบบนำทาง (Compass)" },
  { name: "Calendar", label: "ตารางเวลา/ปฏิทิน (Calendar)" },
  { name: "FileText", label: "เอกสาร/คำร้อง (FileText)" },
  { name: "ShieldAlert", label: "ระบบความปลอดภัย/ข้อมูลส่วนตัว (ShieldAlert)" },
  { name: "Settings", label: "ตั้งค่า/หลังบ้าน (Settings)" },
  { name: "HelpCircle", label: "ช่วยเหลือ/แนะนำ (HelpCircle)" },
  { name: "Link", label: "ลิงก์ทั่วไป (Link)" }
];
