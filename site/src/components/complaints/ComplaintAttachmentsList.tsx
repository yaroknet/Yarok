import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileText, Image, File, Download, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

interface ComplaintAttachmentsListProps {
  complaintId: string;
  refreshTrigger?: number;
}

export function ComplaintAttachmentsList({ complaintId, refreshTrigger }: ComplaintAttachmentsListProps) {
  const { isSuperAdmin, isManager } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttachments();
  }, [complaintId, refreshTrigger]);

  const fetchAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from('complaint_attachments')
        .select('*')
        .eq('complaint_id', complaintId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error('Error fetching attachments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (type: string | null) => {
    if (!type) return <File className="h-4 w-4" />;
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (type.includes('pdf')) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      // Extract path from URL
      const urlParts = attachment.file_url.split('/complaint-attachments/');
      if (urlParts.length < 2) {
        window.open(attachment.file_url, '_blank');
        return;
      }

      const filePath = urlParts[1];
      const { data, error } = await supabase.storage
        .from('complaint-attachments')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      // Fallback to direct link
      window.open(attachment.file_url, '_blank');
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!confirm('האם למחוק את הקובץ?')) return;

    try {
      // Delete from storage
      const urlParts = attachment.file_url.split('/complaint-attachments/');
      if (urlParts.length >= 2) {
        const filePath = urlParts[1];
        await supabase.storage
          .from('complaint-attachments')
          .remove([filePath]);
      }

      // Delete from database
      const { error } = await supabase
        .from('complaint_attachments')
        .delete()
        .eq('id', attachment.id);

      if (error) throw error;

      toast.success('הקובץ נמחק');
      fetchAttachments();
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast.error('שגיאה במחיקת הקובץ');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        אין קבצים מצורפים
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
        >
          <div className="flex items-center gap-3">
            {getFileIcon(attachment.file_type)}
            <div>
              <p className="text-sm font-medium truncate max-w-[200px]">
                {attachment.file_name}
              </p>
              {attachment.file_size && (
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.file_size)}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDownload(attachment)}
            >
              <Download className="h-4 w-4" />
            </Button>
            {(isSuperAdmin || isManager) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(attachment)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
