import { supabase } from './supabase';

export type TeacherRequest = {
  id: string;
  user_id: string;
  full_name: string;
  school_staff_id: string | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

export async function getMyTeacherRequest(
  userId: string
): Promise<TeacherRequest | null> {
  const { data, error } = await supabase
    .from('teacher_requests')
    .select(
      'id, user_id, full_name, school_staff_id, reason, status, created_at, reviewed_by, reviewed_at'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as TeacherRequest;
}

export async function createTeacherRequest(
  userId: string,
  fullName: string,
  schoolStaffId: string,
  reason: string
): Promise<{ data: TeacherRequest | null; error: string | null }> {
  const { data, error } = await supabase
    .from('teacher_requests')
    .insert({
      user_id: userId,
      full_name: fullName,
      school_staff_id: schoolStaffId || null,
      reason: reason || null,
      status: 'pending',
    })
    .select()
    .single();

  return {
    data: data as TeacherRequest | null,
    error: error?.message ?? null,
  };
}

export async function getPendingTeacherRequests(): Promise<{
  data: TeacherRequest[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('teacher_requests')
    .select(
      'id, user_id, full_name, school_staff_id, reason, status, created_at, reviewed_by, reviewed_at'
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  return {
    data: (data ?? []) as TeacherRequest[],
    error: error?.message ?? null,
  };
}

export async function approveTeacherRequest(
  requestId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc(
    'approve_teacher_request',
    {
      p_request_id: requestId,
    }
  );

  return {
    error: error?.message ?? null,
  };
}

export async function rejectTeacherRequest(
  requestId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc(
    'reject_teacher_request',
    {
      p_request_id: requestId,
    }
  );

  return {
    error: error?.message ?? null,
  };
}