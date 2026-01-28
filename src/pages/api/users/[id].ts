import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, hashPassword, createAuditLog } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const targetUser = await prisma.user.findUnique({
        where: { id: id as string },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          specialty: true,
          npiNumber: true,
          licenseNumber: true,
          phone: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.status(200).json(targetUser);
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    // Only admins can update other users, users can update themselves
    if (user.role !== 'ADMIN' && user.id !== id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      const { firstName, lastName, specialty, npiNumber, licenseNumber, phone, role, isActive, password } = req.body;

      const updateData: any = {};

      if (firstName) updateData.firstName = firstName;
      if (lastName) updateData.lastName = lastName;
      if (specialty !== undefined) updateData.specialty = specialty;
      if (npiNumber !== undefined) updateData.npiNumber = npiNumber;
      if (licenseNumber !== undefined) updateData.licenseNumber = licenseNumber;
      if (phone !== undefined) updateData.phone = phone;

      // Only admins can change roles and status
      if (user.role === 'ADMIN') {
        if (role) updateData.role = role;
        if (isActive !== undefined) updateData.isActive = isActive;
      }

      if (password) {
        updateData.password = await hashPassword(password);
      }

      const oldUser = await prisma.user.findUnique({ where: { id: id as string } });

      const updatedUser = await prisma.user.update({
        where: { id: id as string },
        data: updateData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          specialty: true,
          npiNumber: true,
          licenseNumber: true,
          phone: true,
          isActive: true,
        },
      });

      await createAuditLog(user.id, 'UPDATE', 'User', id as string, oldUser, updatedUser, req);

      res.status(200).json(updatedUser);
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      // Soft delete - deactivate instead of deleting
      const deletedUser = await prisma.user.update({
        where: { id: id as string },
        data: { isActive: false },
      });

      await createAuditLog(user.id, 'DELETE', 'User', id as string, { isActive: true }, { isActive: false }, req);

      res.status(200).json({ message: 'User deactivated successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
