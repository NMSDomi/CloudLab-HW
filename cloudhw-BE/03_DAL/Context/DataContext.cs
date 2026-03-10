using cloudhw_BE.DAL.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace cloudhw_BE.DAL.Context;
public class DataContext(
    DbContextOptions<DataContext> options,
    ISystemContext _systemContext
    ) : IdentityDbContext<User>(options)
{
    public DbSet<Album> Albums => Set<Album>();
    public DbSet<Picture> Pictures => Set<Picture>();
    public DbSet<AlbumShare> AlbumShares => Set<AlbumShare>();

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.UseNpgsql(_systemContext.GetConnectionString());
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Album -> Owner
        modelBuilder.Entity<Album>(e =>
        {
            e.HasKey(a => a.Id);

            e.HasOne(a => a.Owner)
             .WithMany(u => u.Albums)
             .HasForeignKey(a => a.OwnerId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(a => a.OwnerId);

            e.HasOne(a => a.CoverPicture)
             .WithOne()
             .HasForeignKey<Album>(a => a.CoverPictureId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        // Picture -> Album
        modelBuilder.Entity<Picture>(e =>
        {
            e.HasKey(p => p.Id);

            e.Property(p => p.CreatedAt)
             .HasPrecision(0);

            e.Property(p => p.UploadedAt)
             .HasPrecision(0);

            e.HasOne(p => p.Album)
             .WithMany(a => a.Pictures)
             .HasForeignKey(p => p.AlbumId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(p => p.AlbumId);
        });

        // AlbumShare – many-to-many join table
        modelBuilder.Entity<AlbumShare>(e =>
        {
            e.HasKey(s => new { s.UserId, s.AlbumId });

            e.HasOne(s => s.User)
             .WithMany(u => u.SharedAlbums)
             .HasForeignKey(s => s.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(s => s.Album)
             .WithMany(a => a.SharedWith)
             .HasForeignKey(s => s.AlbumId)
             .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
