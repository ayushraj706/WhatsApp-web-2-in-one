"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Send } from "lucide-react";

interface InteractiveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (data: any) => void;
}

export function InteractiveMessageDialog({ isOpen, onClose, onSend }: InteractiveDialogProps) {
  const [text, setText] = useState("");
  const [footer, setFooter] = useState("Powered by BaseKey");
  const [buttons, setButtons] = useState([{ id: "1", text: "" }]);

  const addButton = () => {
    if (buttons.length < 3) {
      setButtons([...buttons, { id: Math.random().toString(), text: "" }]);
    }
  };

  const removeButton = (id: string) => {
    setButtons(buttons.filter(b => b.id !== id));
  };

  const handleSend = () => {
    const payload = {
      text,
      footer,
      buttons: buttons.map(b => b.text).filter(t => t !== ""),
    };
    onSend(payload);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl bg-white dark:bg-[#202c33] border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
            Create Buttons Message
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label className="text-xs font-bold opacity-70 uppercase">Main Message</Label>
            <textarea 
              className="w-full p-3 rounded-xl bg-muted/40 border-none focus:ring-1 focus:ring-primary outline-none text-sm min-h-[80px]"
              placeholder="Hi! Choose an option below:"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          
          <div className="grid gap-2">
            <Label className="text-xs font-bold opacity-70 uppercase">Footer Text</Label>
            <Input 
              className="rounded-xl bg-muted/40 border-none h-10 text-sm"
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-bold opacity-70 uppercase">Buttons (Max 3)</Label>
              <Button size="sm" variant="ghost" onClick={addButton} disabled={buttons.length >= 3} className="h-7 text-primary">
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            {buttons.map((btn, index) => (
              <div key={btn.id} className="flex gap-2 items-center">
                <Input 
                  placeholder={`Button ${index + 1} text`} 
                  className="rounded-xl bg-muted/40 border-none h-10 text-sm"
                  value={btn.text}
                  onChange={(e) => {
                    const newBtns = [...buttons];
                    newBtns[index].text = e.target.value;
                    setButtons(newBtns);
                  }}
                />
                <Button size="icon" variant="ghost" className="text-red-500 h-9 w-9" onClick={() => removeButton(btn.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button className="w-full rounded-xl h-11 font-bold gap-2 shadow-lg" onClick={handleSend} disabled={!text}>
            <Send className="h-4 w-4" /> Send Interactive Message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

